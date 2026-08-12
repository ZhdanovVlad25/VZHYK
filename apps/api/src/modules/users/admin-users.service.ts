import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, Repository } from 'typeorm';
import { User } from './user.entity';
import { Listing } from '../listings/listing.entity';
import { Report } from '../reports/report.entity';
import { RiskSignal } from '../risk/risk-signal.entity';
import { RiskScore } from '../risk/risk-score.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ProfilesService, PublicProfile } from '../profiles/profiles.service';

export interface AdminUserView {
  id: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  createdAt: Date;
}

export interface AdminUserDetail extends AdminUserView {
  profile: PublicProfile;
  listings: Pick<Listing, 'id' | 'title' | 'status' | 'price' | 'currency' | 'createdAt'>[];
  reports: Pick<Report, 'id' | 'targetType' | 'targetId' | 'reason' | 'status' | 'createdAt'>[];
  riskScore: number;
  riskSignals: Pick<RiskSignal, 'id' | 'signalType' | 'weight' | 'metadata' | 'createdAt'>[];
}

/** docs/api.md §12 Admin — пошук/блокування користувачів + детальний перегляд одного. */
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(RiskSignal) private readonly riskSignals: Repository<RiskSignal>,
    @InjectRepository(RiskScore) private readonly riskScores: Repository<RiskScore>,
    private readonly auditLog: AuditLogService,
    private readonly profiles: ProfilesService,
  ) {}

  async search(query?: string): Promise<AdminUserView[]> {
    const where = query ? [{ phone: ILike(`%${query}%`) }, { email: ILike(`%${query}%`) }] : {};
    const found = await this.users.find({ where, order: { createdAt: 'DESC' }, take: 50 });
    return found.map((u) => ({ id: u.id, phone: u.phone, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt }));
  }

  /** docs/roadmap.md Phase 5 — детальний перегляд юзера (історія оголошень/скарг/risk-сигналів). */
  async getDetail(userId: string): Promise<AdminUserDetail> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }

    const [profile, listings, allListingIds, riskScoreRow, riskSignals] = await Promise.all([
      this.profiles.getPublicProfile(userId),
      this.listings.find({
        where: { userId, deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.listings.find({ where: { userId, deletedAt: IsNull() }, select: ['id'] }),
      this.riskScores.findOne({ where: { userId } }),
      this.riskSignals.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 20 }),
    ]);

    /** Скарги і на самого юзера, і на будь-яке з його оголошень (усі, не лише останні 20) — той самий патерн, що RiskService.checkHighReportCount(). */
    const listingIds = allListingIds.map((l) => l.id);
    const reports = await this.reports.find({
      where: [
        { targetType: 'USER', targetId: userId },
        ...(listingIds.length > 0 ? [{ targetType: 'LISTING' as const, targetId: In(listingIds) }] : []),
      ],
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      profile,
      listings,
      reports,
      riskScore: riskScoreRow?.score ?? 0,
      riskSignals,
    };
  }

  async block(actorId: string, targetId: string, ip: string | null): Promise<AdminUserView> {
    return this.setStatus(actorId, targetId, 'blocked', 'user.block', ip);
  }

  async unblock(actorId: string, targetId: string, ip: string | null): Promise<AdminUserView> {
    return this.setStatus(actorId, targetId, 'active', 'user.unblock', ip);
  }

  private async setStatus(
    actorId: string,
    targetId: string,
    status: 'active' | 'blocked',
    action: string,
    ip: string | null,
  ): Promise<AdminUserView> {
    if (actorId === targetId) {
      throw new BadRequestException({ code: 'USER_CANNOT_SELF_BLOCK', message: 'Не можна заблокувати самого себе' });
    }

    const user = await this.users.findOne({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }

    const before = { status: user.status };
    user.status = status;
    const saved = await this.users.save(user);

    await this.auditLog.record({
      actorUserId: actorId,
      action,
      targetType: 'user',
      targetId,
      before,
      after: { status: saved.status },
      ip,
    });

    return { id: saved.id, phone: saved.phone, email: saved.email, role: saved.role, status: saved.status, createdAt: saved.createdAt };
  }
}
