import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SearchFilters, SearchProvider, SearchResult, SearchResultItem, SearchSort } from './search-provider.interface';
import { decodeCursor, encodeCursor } from '../../shared/pagination/cursor';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_SUGGESTIONS = 20;

interface SortConfig {
  /** Повний SQL-вираз (не alias — WHERE не бачить SELECT-alias), придатний і для ORDER BY, і для keyset-порівняння. */
  expr: string;
  direction: 'ASC' | 'DESC';
  cast: string;
}

/**
 * docs/architecture.md §4 SearchProvider (MVP). 'simple' text search config — без стемінгу,
 * бо стандартна поставка Postgres не має українського словника.
 *
 * Свідомо поза цим зрізом (задокументовано, не забуто): region/city/district — окремі
 * фільтри рівнів локації (потрібне розгортання дерева locations); attrs[] — фільтрація
 * за динамічними атрибутами категорії (потрібне приведення типів per data_type); category
 * фільтрує лише за точним categoryId, без рекурсії по підкатегоріях.
 */
@Injectable()
export class PostgresFtsSearchProvider implements SearchProvider {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async index(): Promise<void> {
    // no-op: search_vector підтримується DB-тригером (migration 1754800300000) — рядок завжди актуальний.
  }

  async remove(): Promise<void> {
    // no-op: search() фільтрує за status='ACTIVE' AND deletedAt IS NULL — рядок сам відпадає.
  }

  async search(filters: SearchFilters): Promise<SearchResult> {
    const limit = Math.min(Math.max(filters.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    let sort = filters.sort ?? (filters.q ? 'relevance' : 'newest');
    if (sort === 'relevance' && !filters.q) {
      sort = 'newest'; // relevance без пошукового запиту не має сенсу — м'який fallback замість помилки
    }

    const params: unknown[] = [];
    const conditions: string[] = [`l."status" = 'ACTIVE'`, `l."deletedAt" IS NULL`];
    let rankExpr = 'NULL::real';

    if (filters.q) {
      params.push(filters.q);
      const qIdx = params.length;
      rankExpr = `ts_rank(l."searchVector", websearch_to_tsquery('simple', $${qIdx}))`;
      conditions.push(`l."searchVector" @@ websearch_to_tsquery('simple', $${qIdx})`);
    }
    if (filters.categoryId) {
      params.push(filters.categoryId);
      conditions.push(`l."categoryId" = $${params.length}`);
    }
    if (filters.priceMin !== undefined) {
      params.push(filters.priceMin);
      conditions.push(`l."price" >= $${params.length}`);
    }
    if (filters.priceMax !== undefined) {
      params.push(filters.priceMax);
      conditions.push(`l."price" <= $${params.length}`);
    }
    if (filters.condition) {
      params.push(filters.condition);
      conditions.push(`l."condition" = $${params.length}`);
    }
    if (filters.hasPhoto) {
      conditions.push(`EXISTS (SELECT 1 FROM "media" m WHERE m."listingId" = l."id")`);
    }

    const sortConfig = this.sortConfig(sort, rankExpr);
    if (sort === 'price_asc' || sort === 'price_desc') {
      conditions.push(`l."price" IS NOT NULL`); // keyset-порівняння з NULL непередбачуване — сортовані-за-ціною списки виключають безцінові
    }

    if (filters.cursor) {
      const cursor = this.parseCursor(filters.cursor);
      params.push(cursor.v, cursor.id);
      const op = sortConfig.direction === 'DESC' ? '<' : '>';
      conditions.push(`(${sortConfig.expr}, l."id") ${op} ($${params.length - 1}${sortConfig.cast}, $${params.length})`);
    }

    params.push(limit + 1);
    const sql = `
      SELECT l."id", l."title", l."price", l."currency", l."categoryId", l."locationId", l."publishedAt",
             ${rankExpr} AS "rank",
             (SELECT m."id" FROM "media" m WHERE m."listingId" = l."id" AND m."isMain" = true LIMIT 1) AS "mainMediaId",
             (SELECT m."storageKey" FROM "media" m WHERE m."listingId" = l."id" AND m."isMain" = true LIMIT 1) AS "mainMediaStorageKey"
      FROM "listings" l
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortConfig.expr} ${sortConfig.direction}, l."id" ${sortConfig.direction}
      LIMIT $${params.length}
    `;

    const rows = await this.dataSource.query<Array<Record<string, unknown>>>(sql, params);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const items: SearchResultItem[] = await Promise.all(page.map((row) => this.toItem(row)));

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = page[page.length - 1];
      nextCursor = encodeCursor({ v: this.cursorValue(last, sort), id: last.id as string });
    }

    return { items, nextCursor };
  }

  async suggest(prefix: string, limit = 10): Promise<string[]> {
    if (!prefix.trim()) {
      return [];
    }
    const rows = await this.dataSource.query<Array<{ title: string }>>(
      `SELECT DISTINCT l."title" FROM "listings" l
       WHERE l."status" = 'ACTIVE' AND l."deletedAt" IS NULL AND l."title" ILIKE $1
       ORDER BY l."title" ASC
       LIMIT $2`,
      [`${prefix}%`, Math.min(Math.max(limit, 1), MAX_SUGGESTIONS)],
    );
    return rows.map((r) => r.title);
  }

  private sortConfig(sort: SearchSort, rankExpr: string): SortConfig {
    switch (sort) {
      case 'relevance':
        return { expr: rankExpr, direction: 'DESC', cast: '::real' };
      case 'price_asc':
        return { expr: 'l."price"', direction: 'ASC', cast: '::numeric' };
      case 'price_desc':
        return { expr: 'l."price"', direction: 'DESC', cast: '::numeric' };
      case 'newest':
      default:
        return { expr: 'l."publishedAt"', direction: 'DESC', cast: '::timestamptz' };
    }
  }

  private cursorValue(row: Record<string, unknown>, sort: SearchSort): string {
    switch (sort) {
      case 'relevance':
        return String(row.rank);
      case 'price_asc':
      case 'price_desc':
        return String(row.price);
      case 'newest':
      default:
        return new Date(row.publishedAt as string).toISOString();
    }
  }

  private parseCursor(raw: string) {
    try {
      return decodeCursor(raw);
    } catch {
      throw new BadRequestException({ code: 'SEARCH_INVALID_CURSOR', message: 'Некоректний курсор пагінації' });
    }
  }

  private async toItem(row: Record<string, unknown>): Promise<SearchResultItem> {
    const mainMediaId = (row.mainMediaId as string | null) ?? null;
    const mainStorageKey = (row.mainMediaStorageKey as string | null) ?? null;
    return {
      id: row.id as string,
      title: row.title as string,
      price: row.price === null ? null : Number(row.price),
      currency: row.currency as string,
      categoryId: row.categoryId as string,
      locationId: (row.locationId as string | null) ?? null,
      publishedAt: row.publishedAt ? new Date(row.publishedAt as string).toISOString() : null,
      mainMediaId,
      // Presign — локальний HMAC без мережевого виклику, тому дешево робити навіть для 50 елементів сторінки.
      mainMediaUrl: mainStorageKey ? await this.storage.getSignedUrl(mainStorageKey) : null,
    };
  }
}
