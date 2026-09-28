import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { LISTING_STATUSES, ListingStatus, SELLER_TYPES, SellerType } from '../listings/listing.constants';
import { ModerationCase } from '../moderation/moderation-case.entity';
import { Report } from '../reports/report.entity';
import { RiskScore } from '../risk/risk-score.entity';
import { SettingsService } from '../settings/settings.service';

export interface TrafficStats {
  pageviews: number;
  visitors: number;
  visits: number;
}

export interface DashboardMetrics {
  users: { total: number; active: number; blocked: number };
  listings: { total: number; byStatus: Record<ListingStatus, number>; bySellerType: Record<SellerType, number> };
  moderation: { pending: number; needsReview: number };
  reports: { pending: number; reviewing: number };
  riskFlaggedUsers: number;
  /** null — UMAMI_* не налаштовано або сам запит до Umami впав (best-effort, не має ламати
   * решту дашборду). */
  traffic: { last7Days: TrafficStats; last30Days: TrafficStats } | null;
}

/**
 * docs/api.md §12 GET /admin/dashboard — агреговані метрики. Паралельні repo.count()
 * замість groupBy (немає groupBy-прецеденту в кодовій базі, див. risk.service.ts).
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ModerationCase) private readonly moderationCases: Repository<ModerationCase>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(RiskScore) private readonly riskScores: Repository<RiskScore>,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
  ) {}

  async getMetrics(): Promise<DashboardMetrics> {
    const [totalUsers, activeUsers, blockedUsers] = await Promise.all([
      this.users.count({ where: { deletedAt: IsNull() } }),
      this.users.count({ where: { deletedAt: IsNull(), status: 'active' } }),
      this.users.count({ where: { deletedAt: IsNull(), status: 'blocked' } }),
    ]);

    const totalListings = await this.listings.count({ where: { deletedAt: IsNull() } });
    const byStatusPairs = await Promise.all(
      LISTING_STATUSES.map(
        async (status) => [status, await this.listings.count({ where: { status, deletedAt: IsNull() } })] as const,
      ),
    );
    const byStatus = Object.fromEntries(byStatusPairs) as Record<ListingStatus, number>;

    const bySellerTypePairs = await Promise.all(
      SELLER_TYPES.map(
        async (sellerType) =>
          [sellerType, await this.listings.count({ where: { sellerType, deletedAt: IsNull() } })] as const,
      ),
    );
    const bySellerType = Object.fromEntries(bySellerTypePairs) as Record<SellerType, number>;

    const [pendingCases, needsReviewCases] = await Promise.all([
      this.moderationCases.count({ where: { status: 'PENDING' } }),
      this.moderationCases.count({ where: { status: 'NEEDS_REVIEW' } }),
    ]);

    const [pendingReports, reviewingReports] = await Promise.all([
      this.reports.count({ where: { status: 'PENDING' } }),
      this.reports.count({ where: { status: 'REVIEWING' } }),
    ]);

    const threshold = await this.settings.getRiskNeedsReviewThreshold();
    const riskFlaggedUsers = await this.riskScores.count({ where: { score: MoreThan(threshold) } });

    const traffic = await this.getTrafficStats();

    return {
      users: { total: totalUsers, active: activeUsers, blocked: blockedUsers },
      listings: { total: totalListings, byStatus, bySellerType },
      moderation: { pending: pendingCases, needsReview: needsReviewCases },
      reports: { pending: pendingReports, reviewing: reviewingReports },
      riskFlaggedUsers,
      traffic,
    };
  }

  /** Self-hosted Umami (.railway/railway.ts UMAMI_*) — відвідування/перегляди сторінок за
   * останні 7/30 днів. Best-effort: недоступність Umami не має валити весь дашборд. */
  private async getTrafficStats(): Promise<DashboardMetrics['traffic']> {
    const apiUrl = this.config.get<string>('UMAMI_API_URL');
    const apiKey = this.config.get<string>('UMAMI_API_KEY');
    const websiteId = this.config.get<string>('UMAMI_WEBSITE_ID');
    if (!apiUrl || !apiKey || !websiteId) return null;

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    try {
      const [last7Days, last30Days] = await Promise.all([
        this.fetchUmamiStats(apiUrl, apiKey, websiteId, now - 7 * DAY_MS, now),
        this.fetchUmamiStats(apiUrl, apiKey, websiteId, now - 30 * DAY_MS, now),
      ]);
      return { last7Days, last30Days };
    } catch (err) {
      this.logger.warn(`Не вдалось отримати статистику Umami: ${(err as Error).message}`);
      return null;
    }
  }

  private async fetchUmamiStats(
    apiUrl: string,
    apiKey: string,
    websiteId: string,
    startAt: number,
    endAt: number,
  ): Promise<TrafficStats> {
    const res = await fetch(`${apiUrl}/api/websites/${websiteId}/stats?startAt=${startAt}&endAt=${endAt}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      throw new Error(`Umami API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { pageviews?: number; visitors?: number; visits?: number };
    return {
      pageviews: data.pageviews ?? 0,
      visitors: data.visitors ?? 0,
      visits: data.visits ?? 0,
    };
  }
}
