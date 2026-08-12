import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { LISTING_STATUSES, ListingStatus } from '../listings/listing.constants';
import { ModerationCase } from '../moderation/moderation-case.entity';
import { Report } from '../reports/report.entity';
import { RiskScore } from '../risk/risk-score.entity';
import { SettingsService } from '../settings/settings.service';

export interface DashboardMetrics {
  users: { total: number; active: number; blocked: number };
  listings: { total: number; byStatus: Record<ListingStatus, number> };
  moderation: { pending: number; needsReview: number };
  reports: { pending: number; reviewing: number };
  riskFlaggedUsers: number;
}

/**
 * docs/api.md §12 GET /admin/dashboard — агреговані метрики. Паралельні repo.count()
 * замість groupBy (немає groupBy-прецеденту в кодовій базі, див. risk.service.ts).
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ModerationCase) private readonly moderationCases: Repository<ModerationCase>,
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(RiskScore) private readonly riskScores: Repository<RiskScore>,
    private readonly settings: SettingsService,
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

    return {
      users: { total: totalUsers, active: activeUsers, blocked: blockedUsers },
      listings: { total: totalListings, byStatus },
      moderation: { pending: pendingCases, needsReview: needsReviewCases },
      reports: { pending: pendingReports, reviewing: reviewingReports },
      riskFlaggedUsers,
    };
  }
}
