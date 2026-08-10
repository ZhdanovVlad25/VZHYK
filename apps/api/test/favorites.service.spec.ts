import { FavoritesService } from '../src/modules/favorites/favorites.service';
import { Favorite } from '../src/modules/favorites/favorite.entity';
import { Listing } from '../src/modules/listings/listing.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  delete: jest.Mock;
};

function mockRepo(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
  };
}

describe('FavoritesService', () => {
  let favorites: MockRepo;
  let listings: MockRepo;
  let service: FavoritesService;

  beforeEach(() => {
    favorites = mockRepo();
    listings = mockRepo();
    service = new FavoritesService(favorites as never, listings as never);
  });

  describe('add', () => {
    it('повертає існуючий запис без повторного створення (ідемпотентність)', async () => {
      const existing = { id: 'f-1', userId: 'u-1', listingId: 'l-1' } as Favorite;
      favorites.findOne.mockResolvedValue(existing);

      const result = await service.add('u-1', 'l-1');

      expect(result).toBe(existing);
      expect(favorites.save).not.toHaveBeenCalled();
    });

    it('кидає LISTING_NOT_FOUND для неіснуючого оголошення', async () => {
      favorites.findOne.mockResolvedValue(null);
      listings.findOne.mockResolvedValue(null);

      await expect(service.add('u-1', 'missing')).rejects.toMatchObject({
        response: { code: 'LISTING_NOT_FOUND' },
      });
    });

    it('зберігає priceSnapshot з поточної ціни оголошення', async () => {
      favorites.findOne.mockResolvedValue(null);
      listings.findOne.mockResolvedValue({ id: 'l-1', price: 999, deletedAt: null } as Listing);

      const result = await service.add('u-1', 'l-1');

      expect(result.priceSnapshot).toBe(999);
    });
  });

  describe('remove', () => {
    it('успішний навіть якщо запису не було (ідемпотентність)', async () => {
      await expect(service.remove('u-1', 'never-favorited')).resolves.toBeUndefined();
      expect(favorites.delete).toHaveBeenCalledWith({ userId: 'u-1', listingId: 'never-favorited' });
    });
  });

  describe('list', () => {
    it('повертає порожній список без запиту до listings, якщо обраного немає', async () => {
      favorites.find.mockResolvedValue([]);

      const result = await service.list('u-1');

      expect(result).toEqual([]);
      expect(listings.find).not.toHaveBeenCalled();
    });

    it('priceChanged=true, коли поточна ціна відрізняється від priceSnapshot', async () => {
      favorites.find.mockResolvedValue([
        { id: 'f-1', userId: 'u-1', listingId: 'l-1', priceSnapshot: 1000, createdAt: new Date() } as Favorite,
      ]);
      listings.find.mockResolvedValue([
        { id: 'l-1', title: 'Товар', price: 1500, currency: 'UAH', status: 'ACTIVE', deletedAt: null } as Listing,
      ]);

      const result = await service.list('u-1');

      expect(result[0].priceChanged).toBe(true);
      expect(result[0].isUnavailable).toBe(false);
    });

    it('priceChanged=false, коли ціна не змінилась', async () => {
      favorites.find.mockResolvedValue([
        { id: 'f-1', userId: 'u-1', listingId: 'l-1', priceSnapshot: 1000, createdAt: new Date() } as Favorite,
      ]);
      listings.find.mockResolvedValue([
        { id: 'l-1', title: 'Товар', price: 1000, currency: 'UAH', status: 'ACTIVE', deletedAt: null } as Listing,
      ]);

      const result = await service.list('u-1');

      expect(result[0].priceChanged).toBe(false);
    });

    it('isUnavailable=true для заархівованого оголошення', async () => {
      favorites.find.mockResolvedValue([
        { id: 'f-1', userId: 'u-1', listingId: 'l-1', priceSnapshot: 1000, createdAt: new Date() } as Favorite,
      ]);
      listings.find.mockResolvedValue([
        { id: 'l-1', title: 'Товар', price: 1000, currency: 'UAH', status: 'ARCHIVED', deletedAt: null } as Listing,
      ]);

      const result = await service.list('u-1');

      expect(result[0].isUnavailable).toBe(true);
    });

    it('isUnavailable=true, коли оголошення видалено (не знайдено серед listings)', async () => {
      favorites.find.mockResolvedValue([
        { id: 'f-1', userId: 'u-1', listingId: 'gone', priceSnapshot: 1000, createdAt: new Date() } as Favorite,
      ]);
      listings.find.mockResolvedValue([]);

      const result = await service.list('u-1');

      expect(result[0].isUnavailable).toBe(true);
      expect(result[0].priceChanged).toBe(false);
    });
  });
});
