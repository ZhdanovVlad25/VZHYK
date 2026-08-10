import { SavedSearchesService } from '../src/modules/saved-searches/saved-searches.service';
import { SavedSearch } from '../src/modules/saved-searches/saved-search.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  remove: jest.Mock;
};

function mockRepo(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
    remove: jest.fn(async (entity) => entity),
  };
}

async function expectHttpError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`expected promise to reject with code ${code}`);
  } catch (err) {
    expect((err as { getResponse: () => { code: string } }).getResponse().code).toBe(code);
  }
}

describe('SavedSearchesService', () => {
  let savedSearches: MockRepo;
  let categories: MockRepo;
  let locations: MockRepo;
  let service: SavedSearchesService;

  beforeEach(() => {
    savedSearches = mockRepo();
    categories = mockRepo();
    locations = mockRepo();
    service = new SavedSearchesService(savedSearches as never, categories as never, locations as never);
  });

  describe('create', () => {
    it('створює запис лише з queryText, без category/location', async () => {
      const result = await service.create('u-1', { queryText: 'iphone' });

      expect(result.queryText).toBe('iphone');
      expect(result.categoryId).toBeNull();
      expect(categories.findOne).not.toHaveBeenCalled();
    });

    it('кидає CATEGORY_NOT_FOUND для неіснуючої категорії', async () => {
      categories.findOne.mockResolvedValue(null);

      await expectHttpError(service.create('u-1', { categoryId: 'missing' }), 'CATEGORY_NOT_FOUND');
    });

    it('кидає LOCATION_NOT_FOUND для неіснуючої локації', async () => {
      locations.findOne.mockResolvedValue(null);

      await expectHttpError(service.create('u-1', { regionLocationId: 'missing' }), 'LOCATION_NOT_FOUND');
    });

    it('зберігає filters як є', async () => {
      const result = await service.create('u-1', { filters: { priceMin: 100, hasPhoto: true } });

      expect(result.filters).toEqual({ priceMin: 100, hasPhoto: true });
    });
  });

  describe('list', () => {
    it('повертає лише пошуки цього користувача', async () => {
      await service.list('u-1');

      expect(savedSearches.find).toHaveBeenCalledWith({
        where: { userId: 'u-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('remove', () => {
    it('кидає SAVED_SEARCH_NOT_FOUND для неіснуючого запису', async () => {
      savedSearches.findOne.mockResolvedValue(null);

      await expectHttpError(service.remove('u-1', 'missing'), 'SAVED_SEARCH_NOT_FOUND');
    });

    it('кидає SAVED_SEARCH_NOT_OWNER для чужого запису', async () => {
      savedSearches.findOne.mockResolvedValue({ id: 's-1', userId: 'someone-else' } as SavedSearch);

      await expectHttpError(service.remove('u-1', 's-1'), 'SAVED_SEARCH_NOT_OWNER');
    });

    it('видаляє власний запис', async () => {
      const item = { id: 's-1', userId: 'u-1' } as SavedSearch;
      savedSearches.findOne.mockResolvedValue(item);

      await service.remove('u-1', 's-1');

      expect(savedSearches.remove).toHaveBeenCalledWith(item);
    });
  });
});
