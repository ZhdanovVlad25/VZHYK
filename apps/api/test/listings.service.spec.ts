import { OptimisticLockVersionMismatchError } from 'typeorm';
import { ListingsService } from '../src/modules/listings/listings.service';
import { Listing } from '../src/modules/listings/listing.entity';
import { Category } from '../src/modules/categories/category.entity';
import { CategoryAttribute } from '../src/modules/attributes/category-attribute.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  count: jest.Mock;
  increment: jest.Mock;
};

function mockRepo(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
    count: jest.fn().mockResolvedValue(0),
    increment: jest.fn(),
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

describe('ListingsService', () => {
  let listings: MockRepo;
  let attributeValues: MockRepo;
  let categories: MockRepo;
  let categoryAttributes: MockRepo;
  let priceHistory: MockRepo;
  let settings: { getMaxActiveListingsPerUser: jest.Mock };
  let search: { index: jest.Mock; remove: jest.Mock };
  let moderation: { createCaseForListing: jest.Mock };
  let service: ListingsService;

  const leafCategory = { id: 'cat-1', deletedAt: null, isActive: true } as Category;

  beforeEach(() => {
    listings = mockRepo();
    attributeValues = mockRepo();
    categories = mockRepo();
    categoryAttributes = mockRepo();
    priceHistory = mockRepo();
    settings = { getMaxActiveListingsPerUser: jest.fn().mockResolvedValue(5) };
    search = { index: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
    moderation = { createCaseForListing: jest.fn().mockResolvedValue({ id: 'case-1', status: 'PENDING' }) };

    categories.findOne.mockResolvedValue(leafCategory);
    categories.count.mockResolvedValue(0); // без дочірніх — leaf

    service = new ListingsService(
      listings as never,
      attributeValues as never,
      categories as never,
      categoryAttributes as never,
      priceHistory as never,
      settings as never,
      search as never,
      moderation as never,
    );
  });

  describe('create', () => {
    it('кидає CATEGORY_NOT_FOUND, якщо категорія не існує', async () => {
      categories.findOne.mockResolvedValue(null);

      await expectHttpError(
        service.create('user-1', { categoryId: 'missing', listingType: 'sell', title: 'Тестовий товар' }),
        'CATEGORY_NOT_FOUND',
      );
    });

    it('кидає CATEGORY_NOT_LISTABLE, якщо категорія має підкатегорії', async () => {
      categories.count.mockResolvedValue(2);

      await expectHttpError(
        service.create('user-1', { categoryId: 'cat-1', listingType: 'sell', title: 'Тестовий товар' }),
        'CATEGORY_NOT_LISTABLE',
      );
    });

    it('створює DRAFT-оголошення без атрибутів', async () => {
      const result = await service.create('user-1', {
        categoryId: 'cat-1',
        listingType: 'sell',
        title: 'Тестовий товар',
      });

      expect(result.status).toBe('DRAFT');
      expect(result.userId).toBe('user-1');
      expect(result.attributes).toEqual([]);
    });

    it('кидає LISTING_ATTRIBUTE_UNKNOWN для атрибута з іншої категорії', async () => {
      categoryAttributes.find.mockResolvedValue([]);

      await expectHttpError(
        service.create('user-1', {
          categoryId: 'cat-1',
          listingType: 'sell',
          title: 'Тестовий товар',
          attributes: [{ categoryAttributeId: 'attr-x', value: 'foo' }],
        }),
        'LISTING_ATTRIBUTE_UNKNOWN',
      );
    });

    it('кидає LISTING_ATTRIBUTE_INVALID при невідповідному типу значення', async () => {
      categoryAttributes.find.mockResolvedValue([
        { id: 'attr-1', categoryId: 'cat-1', key: 'year', dataType: 'number' } as CategoryAttribute,
      ]);

      await expectHttpError(
        service.create('user-1', {
          categoryId: 'cat-1',
          listingType: 'sell',
          title: 'Тестовий товар',
          attributes: [{ categoryAttributeId: 'attr-1', value: 'не число' }],
        }),
        'LISTING_ATTRIBUTE_INVALID',
      );
    });
  });

  describe('update', () => {
    it('кидає LISTING_NOT_OWNER, якщо редагує не власник', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'DRAFT' } as Listing);

      await expectHttpError(service.update('someone-else', 'l-1', { title: 'Нова назва тест' }), 'LISTING_NOT_OWNER');
    });

    it('кидає LISTING_NOT_EDITABLE для статусу SOLD', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'SOLD' } as Listing);

      await expectHttpError(service.update('owner', 'l-1', { title: 'Нова назва тест' }), 'LISTING_NOT_EDITABLE');
    });

    it('записує price_history, коли ціна дійсно змінюється', async () => {
      listings.findOne.mockResolvedValue({
        id: 'l-1',
        userId: 'owner',
        status: 'DRAFT',
        price: 1000,
        currency: 'UAH',
      } as Listing);

      await service.update('owner', 'l-1', { price: 1500 });

      expect(priceHistory.save).toHaveBeenCalledWith(
        expect.objectContaining({ listingId: 'l-1', oldPrice: 1000, newPrice: 1500, currency: 'UAH' }),
      );
    });

    it('не записує price_history, якщо ціна не передана в DTO', async () => {
      listings.findOne.mockResolvedValue({
        id: 'l-1',
        userId: 'owner',
        status: 'DRAFT',
        price: 1000,
        currency: 'UAH',
      } as Listing);

      await service.update('owner', 'l-1', { title: 'Нова назва тест' });

      expect(priceHistory.save).not.toHaveBeenCalled();
    });

    it('не записує price_history, якщо нова ціна дорівнює старій', async () => {
      listings.findOne.mockResolvedValue({
        id: 'l-1',
        userId: 'owner',
        status: 'DRAFT',
        price: 1000,
        currency: 'UAH',
      } as Listing);

      await service.update('owner', 'l-1', { price: 1000 });

      expect(priceHistory.save).not.toHaveBeenCalled();
    });
  });

  describe('getPriceHistory', () => {
    it('кидає LISTING_NOT_FOUND, якщо чужу чернетку запитує не власник', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'DRAFT' } as Listing);

      await expectHttpError(service.getPriceHistory('l-1', 'stranger'), 'LISTING_NOT_FOUND');
    });

    it('повертає історію для публічно видимого оголошення', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'ACTIVE' } as Listing);
      priceHistory.find.mockResolvedValue([{ id: 'ph-1', oldPrice: 1000, newPrice: 1500 }]);

      const result = await service.getPriceHistory('l-1', undefined);

      expect(result).toHaveLength(1);
      expect(priceHistory.find).toHaveBeenCalledWith({
        where: { listingId: 'l-1' },
        order: { changedAt: 'DESC' },
      });
    });
  });

  describe('publish', () => {
    const draft = () =>
      ({
        id: 'l-1',
        userId: 'owner',
        categoryId: 'cat-1',
        listingType: 'sell' as const,
        status: 'DRAFT' as const,
        price: 100,
      }) as Listing;

    it('кидає LISTING_PRICE_REQUIRED, якщо ціна не вказана для sell', async () => {
      listings.findOne.mockResolvedValue({ ...draft(), price: null });

      await expectHttpError(service.publish('owner', 'l-1'), 'LISTING_PRICE_REQUIRED');
    });

    it('не вимагає ціну для listingType=give_away', async () => {
      listings.findOne.mockResolvedValue({ ...draft(), listingType: 'give_away', price: null });

      const result = await service.publish('owner', 'l-1');
      expect(result.status).toBe('PENDING_MODERATION');
    });

    it('кидає LISTING_ATTRIBUTES_INCOMPLETE, якщо не заповнені обов’язкові атрибути', async () => {
      listings.findOne.mockResolvedValue(draft());
      categoryAttributes.find.mockResolvedValue([
        { id: 'attr-1', key: 'brand', labelUk: 'Марка', isRequired: true } as CategoryAttribute,
      ]);
      attributeValues.find.mockResolvedValue([]);

      await expectHttpError(service.publish('owner', 'l-1'), 'LISTING_ATTRIBUTES_INCOMPLETE');
    });

    it('кидає LISTING_ACTIVE_LIMIT_REACHED, якщо досягнуто ліміту активних оголошень', async () => {
      listings.findOne.mockResolvedValue(draft());
      listings.count.mockResolvedValue(5);

      await expectHttpError(service.publish('owner', 'l-1'), 'LISTING_ACTIVE_LIMIT_REACHED');
    });

    it('кидає LISTING_INVALID_TRANSITION, якщо оголошення вже ACTIVE', async () => {
      listings.findOne.mockResolvedValue({ ...draft(), status: 'ACTIVE' });

      await expectHttpError(service.publish('owner', 'l-1'), 'LISTING_INVALID_TRANSITION');
    });

    it('успішно переводить DRAFT → PENDING_MODERATION і створює moderation case', async () => {
      listings.findOne.mockResolvedValue(draft());

      const result = await service.publish('owner', 'l-1');

      expect(result.status).toBe('PENDING_MODERATION');
      expect(moderation.createCaseForListing).toHaveBeenCalledWith(result);
      // Індексація в пошуку і publishedAt — лише після ModerationService.decide('APPROVED'), не тут.
      expect(search.index).not.toHaveBeenCalled();
    });
  });

  describe('archive / markSold', () => {
    it('archive() кидає LISTING_INVALID_TRANSITION з DRAFT', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'DRAFT' } as Listing);

      await expectHttpError(service.archive('owner', 'l-1'), 'LISTING_INVALID_TRANSITION');
    });

    it('markSold() дозволений з ACTIVE', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'ACTIVE' } as Listing);

      const result = await service.markSold('owner', 'l-1');
      expect(result.status).toBe('SOLD');
      expect(search.remove).toHaveBeenCalledWith('l-1');
    });
  });

  describe('findOwnListings', () => {
    it('кидає LISTING_STATUS_INVALID для невідомого статусу-фільтра', async () => {
      await expectHttpError(service.findOwnListings('owner', 'not-a-status'), 'LISTING_STATUS_INVALID');
    });

    it('приймає статус у нижньому регістрі й нормалізує до enum', async () => {
      await service.findOwnListings('owner', 'active');

      expect(listings.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE', userId: 'owner' }) }),
      );
    });

    it('без фільтра повертає всі власні оголошення (включно з DRAFT)', async () => {
      await service.findOwnListings('owner', undefined);

      const call = listings.find.mock.calls[0][0];
      expect(call.where.status).toBeUndefined();
      expect(call.where.userId).toBe('owner');
    });
  });

  describe('findVisible', () => {
    it('кидає LISTING_NOT_FOUND (не 403), якщо чужий DRAFT переглядає не власник', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'DRAFT' } as Listing);

      await expectHttpError(service.findVisible('l-1', 'stranger'), 'LISTING_NOT_FOUND');
      expect(listings.increment).not.toHaveBeenCalled();
    });

    it('власник бачить свій DRAFT без інкременту переглядів', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'DRAFT', viewsCount: 0 } as Listing);

      const result = await service.findVisible('l-1', 'owner');

      expect(result.status).toBe('DRAFT');
      expect(listings.increment).not.toHaveBeenCalled();
    });

    it('анонім бачить ACTIVE і лічильник переглядів інкрементується', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'ACTIVE', viewsCount: 3 } as Listing);

      const result = await service.findVisible('l-1', undefined);

      expect(result.viewsCount).toBe(4);
      expect(listings.increment).toHaveBeenCalledWith({ id: 'l-1' }, 'viewsCount', 1);
    });
  });

  describe('optimistic locking', () => {
    it('перетворює OptimisticLockVersionMismatchError на ConflictException LISTING_CONFLICT', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner', status: 'ACTIVE' } as Listing);
      listings.save.mockRejectedValue(new OptimisticLockVersionMismatchError('Listing', 1, 2));

      await expectHttpError(service.markSold('owner', 'l-1'), 'LISTING_CONFLICT');
    });
  });
});
