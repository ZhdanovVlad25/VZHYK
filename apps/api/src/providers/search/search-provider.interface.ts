/**
 * docs/architecture.md §4 — SearchProvider: MVP реалізація PostgresFtsSearchProvider,
 * Phase 6+ — OpenSearchProvider підключається без зміни domain-коду (ListingsService).
 */
export type SearchSort = 'relevance' | 'newest' | 'price_asc' | 'price_desc';

export interface SearchFilters {
  q?: string;
  categoryId?: string;
  locationId?: string;
  userId?: string;
  priceMin?: number;
  priceMax?: number;
  condition?: string;
  hasPhoto?: boolean;
  sort?: SearchSort;
  cursor?: string;
  limit?: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  categoryId: string;
  locationId: string | null;
  locationName: string | null;
  publishedAt: string | null;
  mainMediaId: string | null;
  /** Presigned GET URL для головного фото (StorageProvider) — null, якщо фото немає. */
  mainMediaUrl: string | null;
}

export interface SearchResult {
  items: SearchResultItem[];
  nextCursor: string | null;
}

export interface SearchProvider {
  /** Postgres FTS: no-op — search_vector підтримується DB-тригером, рядок завжди актуальний. */
  index(listingId: string): Promise<void>;
  /** Postgres FTS: no-op — search() фільтрує за status='ACTIVE', видалені/архівні відпадають самі. */
  remove(listingId: string): Promise<void>;
  search(filters: SearchFilters): Promise<SearchResult>;
  suggest(prefix: string, limit?: number): Promise<string[]>;
}

export const SEARCH_PROVIDER = 'SEARCH_PROVIDER';
