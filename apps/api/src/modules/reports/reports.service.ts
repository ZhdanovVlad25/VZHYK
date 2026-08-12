import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { Report } from './report.entity';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { ChatParticipant } from '../chat/chat-participant.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportResolutionStatus } from './dto/resolve-report.dto';
import { REPORT_STATUSES, REPORT_TARGET_TYPES, ReportStatus, ReportTargetType } from './report.constants';
import { RiskService } from '../risk/risk.service';
import { AuditLogService } from '../audit-log/audit-log.service';

/** docs/api.md §10 Reports — створення скарги + перелік своїх. Admin-черга — нижче (§12). */
@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ChatParticipant) private readonly chatParticipants: Repository<ChatParticipant>,
    private readonly risk: RiskService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<Report> {
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

  /** docs/api.md §12 GET /admin/reports — обробка скарг (moderator/admin). */
  async adminList(status?: string, targetType?: string): Promise<Report[]> {
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

    return this.reports.find({ where, order: { createdAt: 'DESC' }, take: 100 });
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
