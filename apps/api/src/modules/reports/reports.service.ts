import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { Report } from './report.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { ChatParticipant } from '../chat/chat-participant.entity';
import { Chat } from '../chat/chat.entity';
import { Profile } from '../profiles/profile.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportResolutionStatus } from './dto/resolve-report.dto';
import { REPORT_STATUSES, REPORT_TARGET_TYPES, ReportStatus, ReportTargetType } from './report.constants';
import { RiskService } from '../risk/risk.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { RateLimitService } from '../../shared/rate-limit.service';

const REPORT_CREATE_DAILY_LIMIT = 10; // docs/security.md §6

/** targetLabel — людинозрозуміла ціль скарги (назва оголошення / ім'я юзера / учасники+оголошення чату).
 * targetListingId — пов'язане оголошення, коли є (сама ціль LISTING, або CHAT про оголошення) — щоб фронт міг дати посилання. */
export interface AdminReportItem extends Report {
  targetLabel: string;
  targetListingId: string | null;
}

/** docs/api.md §10 Reports — створення скарги + перелік своїх. Admin-черга — нижче (§12). */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ChatParticipant) private readonly chatParticipants: Repository<ChatParticipant>,
    @InjectRepository(Chat) private readonly chats: Repository<Chat>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    private readonly risk: RiskService,
    private readonly auditLog: AuditLogService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
    await this.rateLimit.consume(`ratelimit:report_create:${reporterId}`, REPORT_CREATE_DAILY_LIMIT, 86_400);
    await this.assertTargetExists(reporterId, dto.targetType, dto.targetId);

    const saved = await this.reports.save(
      this.reports.create({
        reporterId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        description: dto.description ?? null,
      }),
    );

    /** CHAT-скарги пропускаємо — учасників двоє, неоднозначно, хто винен. */
    const reportedUserId = await this.resolveReportedUserId(dto.targetType, dto.targetId);
    if (reportedUserId) {
      await this.risk.checkHighReportCount(reportedUserId);
    }

    return saved;
  }

  private async resolveReportedUserId(targetType: CreateReportDto['targetType'], targetId: string): Promise<string | null> {
    if (targetType === 'USER') {
      return targetId;
    }
    if (targetType === 'LISTING') {
      const listing = await this.listings.findOne({ where: { id: targetId } });
      return listing?.userId ?? null;
    }
    return null;
  }

  list(reporterId: string): Promise<Report[]> {
    return this.reports.find({ where: { reporterId }, order: { createdAt: 'DESC' } });
  }

  /**
   * docs/api.md §12 GET /admin/reports — обробка скарг (moderator/admin).
   * targetId сам по собі (голий UUID) нічого не каже модератору, на яке саме оголошення чи
   * чат подана скарга — довантажуємо людинозрозумілий targetLabel (+ targetListingId для
   * CHAT, щоб можна було перейти хоча б на пов'язане оголошення, раз прямого перегляду
   * чужого чату в адмінці нема).
   */
  async adminList(status?: string, targetType?: string): Promise<AdminReportItem[]> {
    const where: FindOptionsWhere<Report> = {};

    if (status) {
      const normalized = status.toUpperCase();
      if (!(REPORT_STATUSES as readonly string[]).includes(normalized)) {
        throw new BadRequestException({ code: 'REPORT_STATUS_INVALID', message: `Невідомий статус: ${status}` });
      }
      where.status = normalized as ReportStatus;
    }

    if (targetType) {
      const normalized = targetType.toUpperCase();
      if (!(REPORT_TARGET_TYPES as readonly string[]).includes(normalized)) {
        throw new BadRequestException({ code: 'REPORT_TARGET_TYPE_INVALID', message: `Невідомий тип цілі: ${targetType}` });
      }
      where.targetType = normalized as ReportTargetType;
    }

    const reports = await this.reports.find({ where, order: { createdAt: 'DESC' }, take: 100 });
    return this.attachTargetLabels(reports);
  }

  private async attachTargetLabels(reports: Report[]): Promise<AdminReportItem[]> {
    if (reports.length === 0) return [];

    const listingIds = new Set<string>();
    const userIds = new Set<string>();
    const chatIds = new Set<string>();
    for (const r of reports) {
      if (r.targetType === 'LISTING') listingIds.add(r.targetId);
      if (r.targetType === 'USER') userIds.add(r.targetId);
      if (r.targetType === 'CHAT') chatIds.add(r.targetId);
    }

    const chatRows = chatIds.size
      ? await this.chats.find({ where: { id: In([...chatIds]) } })
      : [];
    for (const chat of chatRows) {
      if (chat.listingId) listingIds.add(chat.listingId);
    }

    const participantRows = chatIds.size
      ? await this.chatParticipants.find({ where: { chatId: In([...chatIds]) } })
      : [];
    for (const p of participantRows) userIds.add(p.userId);

    const [listingRows, userRows, profileRows] = await Promise.all([
      listingIds.size ? this.listings.find({ where: { id: In([...listingIds]) } }) : [],
      userIds.size ? this.users.find({ where: { id: In([...userIds]) } }) : [],
      userIds.size ? this.profiles.find({ where: { userId: In([...userIds]) } }) : [],
    ]);

    const listingTitleById = new Map(listingRows.map((l) => [l.id, l.title]));
    const userById = new Map(userRows.map((u) => [u.id, u]));
    const profileById = new Map(profileRows.map((p) => [p.userId, p]));
    const chatById = new Map(chatRows.map((c) => [c.id, c]));
    const participantsByChatId = new Map<string, string[]>();
    for (const p of participantRows) {
      const list = participantsByChatId.get(p.chatId) ?? [];
      list.push(p.userId);
      participantsByChatId.set(p.chatId, list);
    }

    function userLabel(userId: string): string {
      const profile = profileById.get(userId);
      if (profile?.displayName) return profile.displayName;
      const user = userById.get(userId);
      return user?.phone ?? user?.email ?? `${userId.slice(0, 8)}…`;
    }

    return reports.map((r): AdminReportItem => {
      if (r.targetType === 'LISTING') {
        const title = listingTitleById.get(r.targetId);
        return { ...r, targetLabel: title ?? 'Оголошення видалено', targetListingId: r.targetId };
      }
      if (r.targetType === 'USER') {
        return { ...r, targetLabel: userLabel(r.targetId), targetListingId: null };
      }
      // CHAT
      const chat = chatById.get(r.targetId);
      const listingTitle = chat?.listingId ? listingTitleById.get(chat.listingId) : null;
      const participantIds = participantsByChatId.get(r.targetId) ?? [];
      const names = participantIds.map(userLabel).join(' ↔ ');
      const label = [listingTitle ? `про «${listingTitle}»` : null, names || null].filter(Boolean).join(', ');
      return {
        ...r,
        targetLabel: label || 'Чат видалено',
        targetListingId: chat?.listingId ?? null,
      };
    });
  }

  /**
   * docs/moderation.md §5 флоу new → in_review → resolved | rejected. Не буквально в
   * docs/api.md §12 (там лише GET), але потрібен, щоб чергу можна було реально
   * "обробляти" — той самий парний патерн, що GET queue + POST decide в moderation.
   */
  async resolve(actorId: string, reportId: string, status: ReportResolutionStatus, ip: string | null): Promise<Report> {
    const report = await this.reports.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException({ code: 'REPORT_NOT_FOUND', message: 'Скаргу не знайдено' });
    }
    if (report.status === 'RESOLVED' || report.status === 'REJECTED') {
      throw new BadRequestException({
        code: 'REPORT_ALREADY_DECIDED',
        message: `Скарга вже має рішення: ${report.status}`,
      });
    }

    const before = { status: report.status };
    report.status = status;
    const saved = await this.reports.save(report);

    await this.auditLog.record({
      actorUserId: actorId,
      action: 'report.resolve',
      targetType: 'report',
      targetId: saved.id,
      before,
      after: { status: saved.status },
      ip,
    });

    return saved;
  }

  private async assertTargetExists(reporterId: string, targetType: CreateReportDto['targetType'], targetId: string): Promise<void> {
    if (targetType === 'LISTING') {
      const listing = await this.listings.findOne({ where: { id: targetId, deletedAt: IsNull() } });
      if (!listing) {
        throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Оголошення не знайдено' });
      }
      return;
    }

    if (targetType === 'USER') {
      const user = await this.users.findOne({ where: { id: targetId, deletedAt: IsNull() } });
      if (!user) {
        throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
      }
      return;
    }

    /** targetType === 'CHAT': та сама логіка приховування існування, що й у ChatsService — скаржитись можна лише на свій чат. */
    const participant = await this.chatParticipants.findOne({ where: { chatId: targetId, userId: reporterId } });
    if (!participant) {
      throw new NotFoundException({ code: 'CHAT_NOT_FOUND', message: 'Чат не знайдено' });
    }
  }
}
