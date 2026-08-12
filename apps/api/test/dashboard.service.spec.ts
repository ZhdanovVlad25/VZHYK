import { DashboardService } from '../src/modules/dashboard/dashboard.service';

type MockRepo = { count: jest.Mock };

function mockRepo(defaultCount = 0): MockRepo {
  return { count: jest.fn().mockResolvedValue(defaultCount) };
}

describe('DashboardService', () => {
  let users: MockRepo;
  let listings: MockRepo;
  let moderationCases: MockRepo;
  let reports: MockRepo;
  let riskScores: MockRepo;
  let settings: { getRiskNeedsReviewThreshold: jest.Mock };
  let service: DashboardService;

  beforeEach(() => {
    users = mockRepo(3);
    listings = mockRepo(2);
    moderationCases = mockRepo(1);
    reports = mockRepo(1);
    riskScores = mockRepo(1);
    settings = { getRiskNeedsReviewThreshold: jest.fn().mockResolvedValue(10) };
    service = new DashboardService(
      users as never,
      listings as never,
      moderationCases as never,
      reports as never,
      riskScores as never,
      settings as never,
    );
  });

  it('збирає метрики з паралельних count() по кожному репозиторію', async () => {
    const result = await service.getMetrics();

    expect(result.users).toEqual({ total: 3, active: 3, blocked: 3 });
    expect(result.moderation).toEqual({ pending: 1, needsReview: 1 });
    expect(result.reports).toEqual({ pending: 1, reviewing: 1 });
    expect(result.riskFlaggedUsers).toBe(1);
  });

  it('рахує listings.byStatus для кожного статусу з LISTING_STATUSES', async () => {
    const result = await service.getMetrics();

    expect(Object.keys(result.listings.byStatus)).toEqual(
      expect.arrayContaining(['DRAFT', 'ACTIVE', 'BLOCKED', 'SOLD', 'ARCHIVED']),
    );
    expect(result.listings.total).toBe(2);
  });

  it('використовує risk.needs_review_threshold для riskFlaggedUsers', async () => {
    await service.getMetrics();

    expect(settings.getRiskNeedsReviewThreshold).toHaveBeenCalled();
    expect(riskScores.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.anything() }));
  });
});
