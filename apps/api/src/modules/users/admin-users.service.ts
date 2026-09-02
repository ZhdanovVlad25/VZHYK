import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, Repository } from 'typeorm';
import { User } from './user.entity';
import { Listing } from '../listings/listing.entity';
import { ListingStatus } from '../listings/listing.constants';
import { Report } from '../reports/report.entity';
import { RiskSignal } from '../risk/risk-signal.entity';
import { RiskScore } from '../risk/risk-score.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ProfilesService, PublicProfile } from '../profiles/profiles.service';
import { SEARCH_PROVIDER, SearchProvider } from '../../providers/search/search-provider.interface';

/** Статуси, які реально займають "слот" юзера — той самий набір, що ACTIVE_SLOT_STATUSES у listings.service.ts. */
const BLOCKABLE_LISTING_STATUSES: ListingStatus[] = ['ACTIVE', 'RESERVED'];

export interface AdminUserView {
  id: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  createdAt: Date;
  maxActiveListingsOverride: number | null;
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
    @Inject(SEARCH_PROVIDER) private readonly searchProvider: SearchProvider,
  ) {}

  async search(query?: string): Promise<AdminUserView[]> {
    const where = query ? [{ phone: ILike(`%${query}%`) }, { email: ILike(`%${query}%`) }] : {};
    const found = await this.users.find({ where, order: { createdAt: 'DESC' }, take: 50 });
    return found.map((u) => ({
      id: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      maxActiveListingsOverride: u.maxActiveListingsOverride,
    }));
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
      maxActiveListingsOverride: user.maxActiveListingsOverride,
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

    /**
     * docs/moderation.md §7 — блокування юзера каскадує на його активні оголошення.
     * Розблокування навмисно НЕ відновлює їх автоматично (той самий консервативний
     * принцип, що NEEDS_REVIEW не авто-схвалюється) — адмін переглядає й розблоковує
     * кожне окремо через /admin/listings.
     */
    let blockedListingIds: string[] = [];
    if (status === 'blocked') {
      const listingsToBlock = await this.listings.find({
        where: { userId: targetId, status: In(BLOCKABLE_LISTING_STATUSES), deletedAt: IsNull() },
      });
      for (const listing of listingsToBlock) {
        listing.status = 'BLOCKED';
        await this.listings.save(listing);
        await this.searchProvider.remove(listing.id);
      }
      blockedListingIds = listingsToBlock.map((l) => l.id);
    }

    await this.auditLog.record({
      actorUserId: actorId,
      action,
      targetType: 'user',
      targetId,
      before,
      after: { status: saved.status, ...(blockedListingIds.length > 0 ? { blockedListingIds } : {}) },
      ip,
    });

    return {
      id: saved.id,
      phone: saved.phone,
      email: saved.email,
      role: saved.role,
      status: saved.status,
      createdAt: saved.createdAt,
      maxActiveListingsOverride: saved.maxActiveListingsOverride,
    };
  }

  /**
   * Пілотні продавці (Крок 3 "Вжик проти OLX" — ручне наповнення сайту їхніми каталогами)
   * мають виставляти 20-50+ оголошень одночасно замість типового ліміту DEC-05 (default 5).
   * null скидає до типового ліміту.
   */
  async setMaxActiveListingsOverride(
    actorId: string,
    targetId: string,
    value: number | null,
    ip: string | null,
  ): Promise<AdminUserView> {
    const user = await this.users.findOne({ where: { id: targetId } });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }

    const before = { maxActiveListingsOverride: user.maxActiveListingsOverride };
    user.maxActiveListingsOverride = value;
    const saved = await this.users.save(user);

    await this.auditLog.record({
      actorUserId: actorId,
      action: 'user.set_max_active_listings_override',
      targetType: 'user',
      targetId,
      before,
      after: { maxActiveListingsOverride: saved.maxActiveListingsOverride },
      ip,
    });

    return {
      id: saved.id,
      phone: saved.phone,
      email: saved.email,
      role: saved.role,
      status: saved.status,
      createdAt: saved.createdAt,
      maxActiveListingsOverride: saved.maxActiveListingsOverride,
    };
  }
}
