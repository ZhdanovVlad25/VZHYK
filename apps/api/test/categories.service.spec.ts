import { CategoriesService } from '../src/modules/categories/categories.service';
import { Category } from '../src/modules/categories/category.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  count: jest.Mock;
};

function mockRepo(): MockRepo {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
    count: jest.fn(),
  };
}

function mockRedis() {
  return { get: jest.fn(), set: jest.fn(), del: jest.fn() };
}

async function expectHttpError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`expected promise to reject with code ${code}`);
  } catch (err) {
    expect((err as { getResponse: () => { code: string } }).getResponse().code).toBe(code);
  }
}

describe('CategoriesService', () => {
  let categoriesRepo: MockRepo;
  let attributesRepo: MockRepo;
  let redis: ReturnType<typeof mockRedis>;
  let service: CategoriesService;

  beforeEach(() => {
    categoriesRepo = mockRepo();
    attributesRepo = mockRepo();
    redis = mockRedis();
    service = new CategoriesService(
      categoriesRepo as never,
      attributesRepo as never,
      redis as never,
    );
  });

  describe('create', () => {
    it('створює top-level категорію з level=0, коли parentId не вказано', async () => {
      categoriesRepo.findOne.mockResolvedValue(null); // slug вільний

      const result = await service.create({ nameUk: 'Авто', slug: 'avto' });

      expect(result.level).toBe(0);
      expect(result.parentId).toBeNull();
      expect(redis.del).toHaveBeenCalled();
    });

    it('кидає CATEGORY_SLUG_TAKEN, якщо slug вже зайнятий на цьому рівні', async () => {
      categoriesRepo.findOne.mockResolvedValue({ id: 'existing', parentId: null, slug: 'avto' } as Category);

      await expectHttpError(
        service.create({ nameUk: 'Авто', slug: 'avto' }),
        'CATEGORY_SLUG_TAKEN',
      );
    });

    it('кидає CATEGORY_MAX_DEPTH_EXCEEDED, якщо батько вже на максимальному рівні', async () => {
      categoriesRepo.findOne.mockResolvedValue({
        id: 'parent-lvl-2',
        level: 2,
        deletedAt: null,
      } as Category);

      await expectHttpError(
        service.create({ nameUk: 'Занадто глибоко', slug: 'too-deep', parentId: 'parent-lvl-2' }),
        'CATEGORY_MAX_DEPTH_EXCEEDED',
      );
    });
  });

  describe('update — переміщення в дереві', () => {
    it('кидає CATEGORY_CYCLE при спробі перемістити категорію в її власне піддерево', async () => {
      const catA = { id: 'a', parentId: null, level: 0, slug: 'a', deletedAt: null } as Category;
      const catB = { id: 'b', parentId: 'a', level: 1, slug: 'b', deletedAt: null } as Category;

      categoriesRepo.findOne.mockImplementation(async ({ where }: { where: { id?: string } }) => {
        if (where.id === 'a') return catA;
        if (where.id === 'b') return catB;
        return null;
      });

      // A — батько B; спроба зробити A дитиною B створює цикл
      await expectHttpError(service.update('a', { parentId: 'b' }), 'CATEGORY_CYCLE');
    });

    it('кидає CATEGORY_INVALID_PARENT, якщо категорія стає власним батьком', async () => {
      const catA = { id: 'a', parentId: null, level: 0, slug: 'a', deletedAt: null } as Category;
      categoriesRepo.findOne.mockResolvedValue(catA);

      await expectHttpError(service.update('a', { parentId: 'a' }), 'CATEGORY_INVALID_PARENT');
    });
  });

  describe('remove', () => {
    it('кидає CATEGORY_HAS_CHILDREN, якщо є активні підкатегорії', async () => {
      categoriesRepo.findOne.mockResolvedValue({ id: 'a', deletedAt: null } as Category);
      categoriesRepo.count.mockResolvedValue(2);

      await expectHttpError(service.remove('a'), 'CATEGORY_HAS_CHILDREN');
    });

    it('soft-delete: виставляє deletedAt і isActive=false, коли дітей немає', async () => {
      const category = { id: 'a', deletedAt: null, isActive: true } as Category;
      categoriesRepo.findOne.mockResolvedValue(category);
      categoriesRepo.count.mockResolvedValue(0);

      await service.remove('a');

      expect(category.isActive).toBe(false);
      expect(category.deletedAt).not.toBeNull();
      expect(categoriesRepo.save).toHaveBeenCalledWith(category);
    });
  });

  describe('findTree', () => {
    it('повертає закешоване дерево з Redis без запиту до БД', async () => {
      const cached = [{ id: 'x', children: [] }];
      redis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.findTree();

      expect(result).toEqual(cached);
      expect(categoriesRepo.find).not.toHaveBeenCalled();
    });

    it('будує дерево з плоского списку і кешує результат', async () => {
      redis.get.mockResolvedValue(null);
      categoriesRepo.find.mockResolvedValue([
        { id: 'root', parentId: null, sortOrder: 0 },
        { id: 'child', parentId: 'root', sortOrder: 0 },
      ]);

      const result = await service.findTree();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('root');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children[0].id).toBe('child');
      expect(redis.set).toHaveBeenCalled();
    });
  });
});
