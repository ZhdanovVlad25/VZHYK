import { PostgresFtsSearchProvider } from '../src/providers/search/postgres-fts-search.provider';
import { encodeCursor } from '../src/shared/pagination/cursor';

function mockDataSource(rows: Array<Record<string, unknown>> = []) {
  return { query: jest.fn().mockResolvedValue(rows) };
}

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Тестове оголошення',
    price: '100.00',
    currency: 'UAH',
    categoryId: 'cat-1',
    locationId: null,
    publishedAt: '2026-08-10T12:00:00.000Z',
    rank: 0.5,
    mainMediaId: null,
    ...overrides,
  };
}

describe('PostgresFtsSearchProvider', () => {
  describe('search', () => {
    it('будує запит з websearch_to_tsquery/ts_rank, коли передано q', async () => {
      const ds = mockDataSource();
      const provider = new PostgresFtsSearchProvider(ds as never);

      await provider.search({ q: 'айфон' });

      const [sql, params] = ds.query.mock.calls[0];
      expect(sql).toContain('websearch_to_tsquery');
      expect(sql).toContain('ts_rank');
      expect(params).toContain('айфон');
    });

    it('без q не додає повнотекстову умову і сортує за newest', async () => {
      const ds = mockDataSource();
      const provider = new PostgresFtsSearchProvider(ds as never);

      await provider.search({});

      const [sql] = ds.query.mock.calls[0];
      expect(sql).not.toContain('websearch_to_tsquery');
      expect(sql).toContain('l."publishedAt" DESC');
    });

    it('sort=relevance без q — м’який fallback на newest, а не помилка', async () => {
      const ds = mockDataSource();
      const provider = new PostgresFtsSearchProvider(ds as never);

      await provider.search({ sort: 'relevance' });

      const [sql] = ds.query.mock.calls[0];
      expect(sql).toContain('l."publishedAt" DESC');
    });

    it('додає фільтри category/priceMin/priceMax/condition/hasPhoto', async () => {
      const ds = mockDataSource();
      const provider = new PostgresFtsSearchProvider(ds as never);

      await provider.search({
        categoryId: 'cat-1',
        priceMin: 100,
        priceMax: 500,
        condition: 'new',
        hasPhoto: true,
      });

      const [sql, params] = ds.query.mock.calls[0];
      expect(sql).toContain('l."categoryId" = $1');
      expect(sql).toContain('l."price" >= $2');
      expect(sql).toContain('l."price" <= $3');
      expect(sql).toContain('l."condition" = $4');
      expect(sql).toContain('EXISTS (SELECT 1 FROM "media"');
      expect(params).toEqual(['cat-1', 100, 500, 'new', 21]); // + LIMIT param (limit+1)
    });

    it('price_asc виключає записи без ціни (NULL непередбачуваний у keyset)', async () => {
      const ds = mockDataSource();
      const provider = new PostgresFtsSearchProvider(ds as never);

      await provider.search({ sort: 'price_asc' });

      const [sql] = ds.query.mock.calls[0];
      expect(sql).toContain('l."price" IS NOT NULL');
      expect(sql).toContain('l."price" ASC');
    });

    it('коректно розбирає валідний курсор і додає keyset-умову з кастом типу', async () => {
      const ds = mockDataSource();
      const provider = new PostgresFtsSearchProvider(ds as never);
      const cursor = encodeCursor({ v: '2026-08-01T00:00:00.000Z', id: 'prev-id' });

      await provider.search({ cursor });

      const [sql, params] = ds.query.mock.calls[0];
      expect(sql).toContain('::timestamptz');
      expect(params).toEqual(expect.arrayContaining(['2026-08-01T00:00:00.000Z', 'prev-id']));
    });

    it('кидає SEARCH_INVALID_CURSOR для зіпсованого курсора', async () => {
      const ds = mockDataSource();
      const provider = new PostgresFtsSearchProvider(ds as never);

      await expect(provider.search({ cursor: 'garbage!!!' })).rejects.toMatchObject({
        response: { code: 'SEARCH_INVALID_CURSOR' },
      });
    });

    it('повертає nextCursor, коли рядків більше за limit', async () => {
      const rows = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })];
      const ds = mockDataSource(rows);
      const provider = new PostgresFtsSearchProvider(ds as never);

      const result = await provider.search({ limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).not.toBeNull();
    });

    it('nextCursor=null, коли рядків не більше за limit', async () => {
      const rows = [row({ id: 'a' })];
      const ds = mockDataSource(rows);
      const provider = new PostgresFtsSearchProvider(ds as never);

      const result = await provider.search({ limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('price повертається як number, не string', async () => {
      const ds = mockDataSource([row({ price: '150.50' })]);
      const provider = new PostgresFtsSearchProvider(ds as never);

      const result = await provider.search({});

      expect(result.items[0].price).toBe(150.5);
      expect(typeof result.items[0].price).toBe('number');
    });
  });

  describe('suggest', () => {
    it('повертає [] для порожнього префіксу без запиту до БД', async () => {
      const ds = mockDataSource();
      const provider = new PostgresFtsSearchProvider(ds as never);

      const result = await provider.suggest('   ');

      expect(result).toEqual([]);
      expect(ds.query).not.toHaveBeenCalled();
    });

    it('будує ILIKE-запит з префіксом', async () => {
      const ds = mockDataSource([{ title: 'Айфон 13' }, { title: 'Айфон 14' }]);
      const provider = new PostgresFtsSearchProvider(ds as never);

      const result = await provider.suggest('Айфон');

      expect(result).toEqual(['Айфон 13', 'Айфон 14']);
      const [sql, params] = ds.query.mock.calls[0];
      expect(sql).toContain('ILIKE');
      expect(params[0]).toBe('Айфон%');
    });
  });
});
