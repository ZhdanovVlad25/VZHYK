import { ModerationService } from '../src/modules/moderation/moderation.service';
import { Listing } from '../src/modules/listings/listing.entity';
import { ModerationCase } from '../src/modules/moderation/moderation-case.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
};

function mockRepo(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
  };
}

describe('ModerationService', () => {
  let cases: MockRepo;
  let listings: MockRepo;
  let search: { index: jest.Mock; remove: jest.Mock };
  let service: ModerationService;

  beforeEach(() => {
    cases = mockRepo();
    listings = mockRepo();
    search = { index: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
    service = new ModerationService(cases as never, listings as never, search as never);
  });

  describe('createCaseForListing', () => {
    it('створює PENDING-справу для звичайного тексту', async () => {
      const listing = { id: 'l-1', title: 'iPhone 13', description: 'Стан ідеальний' } as Listing;

      const result = await service.createCaseForListing(listing);

      expect(result).toMatchObject({ listingId: 'l-1', status: 'PENDING', autoFlagReason: null });
    });

    it('автофлагає NEEDS_REVIEW, якщо в тексті є заборонене слово', async () => {
      const listing = { id: 'l-2', title: 'Продам зброя мисливська', description: null } as Listing;

      const result = await service.createCaseForListing(listing);

      expect(result.status).toBe('NEEDS_REVIEW');
      expect(result.autoFlagReason).toContain('зброя');
    });

    it('перевіряє і title, і description (case-insensitive)', async () => {
      const listing = { id: 'l-3', title: 'Щось нормальне', description: 'це НАРКОТИК жарт' } as Listing;

      const result = await service.createCaseForListing(listing);

      expect(result.status).toBe('NEEDS_REVIEW');
    });
  });

  describe('findQueue', () => {
    it('повертає порожній список без запиту до listings, якщо черга порожня', async () => {
      const result = await service.findQueue();

      expect(result).toEqual([]);
      expect(listings.find).not.toHaveBeenCalled();
    });

    it('приєднує дані оголошення до кожної справи', async () => {
      cases.find.mockResolvedValue([{ id: 'c-1', listingId: 'l-1', status: 'PENDING' } as ModerationCase]);
      listings.find.mockResolvedValue([
        { id: 'l-1', title: 'Товар', price: 500, currency: 'UAH', userId: 'u-1' } as Listing,
      ]);

      const result = await service.findQueue();

      expect(result[0].listing).toMatchObject({ id: 'l-1', title: 'Товар', userId: 'u-1' });
    });

    it('фільтрує за статусом, якщо переданий', async () => {
      cases.find.mockResolvedValue([]);

      await service.findQueue('NEEDS_REVIEW');

      expect(cases.find).toHaveBeenCalledWith({ where: { status: 'NEEDS_REVIEW' }, order: { createdAt: 'ASC' } });
    });
  });

  describe('decide', () => {
    it('кидає MODERATION_CASE_NOT_FOUND для неіснуючої справи', async () => {
      cases.findOne.mockResolvedValue(null);

      await expect(service.decide('mod-1', 'missing', 'APPROVED')).rejects.toMatchObject({
        response: { code: 'MODERATION_CASE_NOT_FOUND' },
      });
    });

    it('кидає MODERATION_CASE_ALREADY_DECIDED для вже вирішеної справи', async () => {
      cases.findOne.mockResolvedValue({ id: 'c-1', status: 'APPROVED' } as ModerationCase);

      await expect(service.decide('mod-1', 'c-1', 'REJECTED')).rejects.toMatchObject({
        response: { code: 'MODERATION_CASE_ALREADY_DECIDED' },
      });
    });

    it('APPROVED переводить listing у ACTIVE, виставляє publishedAt і індексує в пошуку', async () => {
      cases.findOne.mockResolvedValue({ id: 'c-1', listingId: 'l-1', status: 'PENDING' } as ModerationCase);
      listings.findOne.mockResolvedValue({ id: 'l-1', status: 'PENDING_MODERATION' } as Listing);

      const result = await service.decide('mod-1', 'c-1', 'APPROVED');

      expect(result).toMatchObject({ status: 'APPROVED', moderatorId: 'mod-1' });
      expect(result.decidedAt).toBeInstanceOf(Date);
      const savedListing = listings.save.mock.calls[0][0];
      expect(savedListing.status).toBe('ACTIVE');
      expect(savedListing.publishedAt).toBeInstanceOf(Date);
      expect(search.index).toHaveBeenCalledWith('l-1');
    });

    it('REJECTED переводить listing у REJECTED без індексації', async () => {
      cases.findOne.mockResolvedValue({ id: 'c-1', listingId: 'l-1', status: 'NEEDS_REVIEW' } as ModerationCase);
      listings.findOne.mockResolvedValue({ id: 'l-1', status: 'PENDING_MODERATION' } as Listing);

      const result = await service.decide('mod-1', 'c-1', 'REJECTED');

      expect(result.status).toBe('REJECTED');
      const savedListing = listings.save.mock.calls[0][0];
      expect(savedListing.status).toBe('REJECTED');
      expect(search.index).not.toHaveBeenCalled();
    });

    it('NEEDS_REVIEW фіксує рішення, але не чіпає listing', async () => {
      cases.findOne.mockResolvedValue({ id: 'c-1', listingId: 'l-1', status: 'PENDING' } as ModerationCase);

      const result = await service.decide('mod-1', 'c-1', 'NEEDS_REVIEW');

      expect(result.status).toBe('NEEDS_REVIEW');
      expect(listings.findOne).not.toHaveBeenCalled();
      expect(listings.save).not.toHaveBeenCalled();
    });

    it('не перезаписує listing, якщо його статус вже не PENDING_MODERATION (гонка)', async () => {
      cases.findOne.mockResolvedValue({ id: 'c-1', listingId: 'l-1', status: 'PENDING' } as ModerationCase);
      listings.findOne.mockResolvedValue({ id: 'l-1', status: 'ARCHIVED' } as Listing);

      const result = await service.decide('mod-1', 'c-1', 'APPROVED');

      expect(result.status).toBe('APPROVED');
      expect(listings.save).not.toHaveBeenCalled();
      expect(search.index).not.toHaveBeenCalled();
    });
  });
});
