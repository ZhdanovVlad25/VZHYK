import { RiskService } from '../src/modules/risk/risk.service';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  count: jest.Mock;
  upsert: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function mockRepo(): MockRepo {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
  };
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
    count: jest.fn().mockResolvedValue(0),
    upsert: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(() => qb),
  };
}

describe('RiskService', () => {
  let signals: MockRepo;
  let scores: MockRepo;
  let listings: MockRepo;
  let reports: MockRepo;
  let service: RiskService;

  beforeEach(() => {
    signals = mockRepo();
    scores = mockRepo();
    listings = mockRepo();
    reports = mockRepo();
    service = new RiskService(signals as never, scores as never, listings as never, reports as never);
  });

  describe('getScore / getScores', () => {
    it('повертає 0, якщо запису ще немає', async () => {
      scores.findOne.mockResolvedValue(null);

      expect(await service.getScore('u-1')).toBe(0);
    });

    it('повертає існуючий score', async () => {
      scores.findOne.mockResolvedValue({ userId: 'u-1', score: 13.5 });

      expect(await service.getScore('u-1')).toBe(13.5);
    });

    it('getScores повертає порожню Map для порожнього масиву без запиту', async () => {
      const result = await service.getScores([]);

      expect(result.size).toBe(0);
      expect(scores.find).not.toHaveBeenCalled();
    });

    it('getScores мапить userId -> score для кількох юзерів', async () => {
      scores.find.mockResolvedValue([
        { userId: 'u-1', score: 5 },
        { userId: 'u-2', score: 10 },
      ]);

      const result = await service.getScores(['u-1', 'u-2']);

      expect(result.get('u-1')).toBe(5);
      expect(result.get('u-2')).toBe(10);
    });
  });

  describe('checkRapidListingCreation', () => {
    it('не пише сигнал, якщо кількість не перевищує поріг', async () => {
      listings.count.mockResolvedValue(3);

      await service.checkRapidListingCreation('u-1');

      expect(signals.save).not.toHaveBeenCalled();
    });

    it('пише rapid_listing_creation, якщо поріг перевищено', async () => {
      listings.count.mockResolvedValue(6);
      const qb = signals.createQueryBuilder();
      qb.getRawOne.mockResolvedValue({ total: '5.00' });

      await service.checkRapidListingCreation('u-1');

      expect(signals.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-1', signalType: 'rapid_listing_creation', weight: 5 }),
      );
      expect(scores.upsert).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-1', score: 5 }), ['userId']);
    });
  });

  describe('checkDuplicateListing', () => {
    it('повертає false і не пише сигнал, якщо дубліката немає', async () => {
      listings.findOne.mockResolvedValue(null);

      const result = await service.checkDuplicateListing('u-1', 'Товар', 100, 'l-1');

      expect(result).toBe(false);
      expect(signals.save).not.toHaveBeenCalled();
    });

    it('повертає true і пише duplicate_listings, якщо знайдено збіг', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-old' });

      const result = await service.checkDuplicateListing('u-1', 'Товар', 100, 'l-new');

      expect(result).toBe(true);
      expect(signals.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-1', signalType: 'duplicate_listings', weight: 8 }),
      );
    });
  });

  describe('checkHighReportCount', () => {
    it('не пише сигнал, якщо кількість скарг нижче порогу', async () => {
      listings.find.mockResolvedValue([]);
      reports.count.mockResolvedValue(2);

      await service.checkHighReportCount('u-1');

      expect(signals.save).not.toHaveBeenCalled();
    });

    it('пише high_report_count, коли поріг досягнуто, враховуючи скарги і на listings', async () => {
      listings.find.mockResolvedValue([{ id: 'l-1' }, { id: 'l-2' }]);
      reports.count.mockResolvedValue(3);

      await service.checkHighReportCount('u-1');

      expect(reports.count).toHaveBeenCalledWith({
        where: [
          { targetType: 'USER', targetId: 'u-1' },
          { targetType: 'LISTING', targetId: expect.anything() },
        ],
      });
      expect(signals.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u-1', signalType: 'high_report_count', weight: 15 }),
      );
    });
  });
});
