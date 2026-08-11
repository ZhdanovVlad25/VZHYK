import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RiskSignal } from './risk-signal.entity';
import { RiskScore } from './risk-score.entity';
import { Listing } from '../listings/listing.entity';
import { Report } from '../reports/report.entity';
import {
  DUPLICATE_LISTING_WINDOW_MS,
  HIGH_REPORT_COUNT_THRESHOLD,
  RAPID_LISTING_CREATION_THRESHOLD,
  RAPID_LISTING_CREATION_WINDOW_MS,
  RISK_SIGNAL_WEIGHTS,
  RiskSignalType,
} from './risk.constants';

/**
 * docs/moderation.md §6 Anti-Fraud. RiskScore = сума ваг усіх RiskSignal юзера (без
 * decay/expiry в цьому зрізі — "basics", не production-калібрована формула).
 * Ніколи не блокує юзера автоматично (docs: "жоден сигнал не блокує... для BLOCKED
 * потрібне ручне підтвердження модератора") — лише впливає на статус ModerationCase
 * через ModerationService, саме блокування лишається виключно ручною дією адміна.
 */
@Injectable()
export class RiskService {
  constructor(
    @InjectRepository(RiskSignal) private readonly signals: Repository<RiskSignal>,
    @InjectRepository(RiskScore) private readonly scores: Repository<RiskScore>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
  ) {}

  async getScore(userId: string): Promise<number> {
    const row = await this.scores.findOne({ where: { userId } });
    return row?.score ?? 0;
  }

  async getScores(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const rows = await this.scores.find({ where: userIds.map((id) => ({ userId: id })) });
    return new Map(rows.map((r) => [r.userId, r.score]));
  }

  /** ListingsService.create() — багато оголошень від того самого юзера за коротке вікно. */
  async checkRapidListingCreation(userId: string): Promise<void> {
    const since = new Date(Date.now() - RAPID_LISTING_CREATION_WINDOW_MS);
    const count = await this.listings.count({ where: { userId, createdAt: MoreThan(since) } });
    if (count > RAPID_LISTING_CREATION_THRESHOLD) {
      await this.recordSignal(userId, 'rapid_listing_creation', { count });
    }
  }

  /**
   * ModerationService.createCaseForListing() — дублікат заголовка+ціни від того ж юзера
   * за коротке вікно (docs/moderation.md §3; без порівняння фото — спрощення).
   * Повертає true, якщо знайдено — викликач додатково використовує це для auto-flag
   * ModerationCase у NEEDS_REVIEW.
   */
  async checkDuplicateListing(userId: string, title: string, price: number | null, excludeListingId: string): Promise<boolean> {
    const since = new Date(Date.now() - DUPLICATE_LISTING_WINDOW_MS);
    const existing = await this.listings.findOne({
      where: {
        userId,
        title: ILike(title.trim()),
        price: price ?? IsNull(),
        deletedAt: IsNull(),
        createdAt: MoreThan(since),
        id: Not(excludeListingId),
      },
    });
    if (existing) {
      await this.recordSignal(userId, 'duplicate_listings', { duplicateOfListingId: existing.id });
      return true;
    }
    return false;
  }

  /** ReportsService.create() — накопичення скарг на юзера (напряму або через його listings). */
  async checkHighReportCount(userId: string): Promise<void> {
    const listingIds = (await this.listings.find({ where: { userId }, select: ['id'] })).map((l) => l.id);
    const count = await this.reports.count({
      where: [
        { targetType: 'USER', targetId: userId },
        ...(listingIds.length > 0 ? [{ targetType: 'LISTING' as const, targetId: In(listingIds) }] : []),
      ],
    });
    if (count >= HIGH_REPORT_COUNT_THRESHOLD) {
      await this.recordSignal(userId, 'high_report_count', { count });
    }
  }

  private async recordSignal(userId: string, signalType: RiskSignalType, metadata: Record<string, unknown>): Promise<void> {
    const weight = RISK_SIGNAL_WEIGHTS[signalType];
    await this.signals.save(this.signals.create({ userId, signalType, weight, metadata }));

    const raw = await this.signals
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.weight), 0)', 'total')
      .where('s."userId" = :userId', { userId })
      .getRawOne<{ total: string }>();
    const score = parseFloat(raw?.total ?? '0');

    await this.scores.upsert(
      { userId, score, lastCalculatedAt: new Date() } as QueryDeepPartialEntity<RiskScore>,
      ['userId'],
    );
  }
}
