import { AttributesService } from '../src/modules/attributes/attributes.service';
import { CategoryAttribute } from '../src/modules/attributes/category-attribute.entity';
import { Category } from '../src/modules/categories/category.entity';

type MockRepo = {
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
};

function mockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
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

describe('AttributesService', () => {
  let attributesRepo: MockRepo;
  let categoriesRepo: MockRepo;
  let service: AttributesService;

  beforeEach(() => {
    attributesRepo = mockRepo();
    categoriesRepo = mockRepo();
    service = new AttributesService(attributesRepo as never, categoriesRepo as never);
  });

  describe('create', () => {
    it('кидає CATEGORY_NOT_FOUND, якщо категорія не існує', async () => {
      categoriesRepo.findOne.mockResolvedValue(null);

      await expectHttpError(
        service.create('missing-category', { key: 'brand', labelUk: 'Марка', dataType: 'enum' }),
        'CATEGORY_NOT_FOUND',
      );
    });

    it('кидає ATTRIBUTE_KEY_TAKEN, якщо key вже існує в цій категорії', async () => {
      categoriesRepo.findOne.mockResolvedValue({ id: 'cat-1', deletedAt: null } as Category);
      attributesRepo.findOne.mockResolvedValue({ id: 'attr-1', key: 'brand' } as CategoryAttribute);

      await expectHttpError(
        service.create('cat-1', { key: 'brand', labelUk: 'Марка', dataType: 'enum' }),
        'ATTRIBUTE_KEY_TAKEN',
      );
    });

    it('створює атрибут з дефолтами isRequired/isFilterable/sortOrder', async () => {
      categoriesRepo.findOne.mockResolvedValue({ id: 'cat-1', deletedAt: null } as Category);
      attributesRepo.findOne.mockResolvedValue(null);

      const result = await service.create('cat-1', { key: 'brand', labelUk: 'Марка', dataType: 'enum' });

      expect(result.categoryId).toBe('cat-1');
      expect(result.isRequired).toBe(false);
      expect(result.isFilterable).toBe(false);
      expect(result.sortOrder).toBe(0);
    });
  });

  describe('update', () => {
    it('кидає ATTRIBUTE_NOT_FOUND, якщо атрибут не існує', async () => {
      attributesRepo.findOne.mockResolvedValue(null);

      await expectHttpError(service.update('missing', { labelUk: 'Нове ім’я' }), 'ATTRIBUTE_NOT_FOUND');
    });

    it('оновлює лише передані поля, решту лишає без змін', async () => {
      const attribute = {
        id: 'attr-1',
        categoryId: 'cat-1',
        key: 'brand',
        labelUk: 'Марка',
        dataType: 'enum',
        isRequired: false,
        isFilterable: true,
        sortOrder: 1,
      } as CategoryAttribute;
      attributesRepo.findOne.mockResolvedValue(attribute);

      const result = await service.update('attr-1', { isRequired: true });

      expect(result.isRequired).toBe(true);
      expect(result.labelUk).toBe('Марка');
      expect(result.isFilterable).toBe(true);
      expect(result.key).toBe('brand');
    });
  });
});
