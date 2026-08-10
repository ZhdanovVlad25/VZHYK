const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** Той самий envelope, що AllExceptionsFilter на бекенді: { error: { code, message, details, traceId } }. */
export class ApiError extends Error {
  code: string;
  details: unknown;
  status: number;

  constructor(status: number, code: string, message: string, details: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: unknown;
}

async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { token, body, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'UNKNOWN_ERROR', err.message ?? res.statusText, err.details ?? null);
  }

  return json as T;
}

// ---- Types ----

export type ListingType = 'sell' | 'buy' | 'exchange' | 'give_away' | 'service' | 'rent';
export type ListingStatus =
  | 'DRAFT'
  | 'PENDING_MODERATION'
  | 'ACTIVE'
  | 'REJECTED'
  | 'RESERVED'
  | 'SOLD'
  | 'EXPIRED'
  | 'ARCHIVED'
  | 'BLOCKED';

export interface Category {
  id: string;
  parentId: string | null;
  nameUk: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  level: number;
  children: Category[];
}

export interface CategoryAttribute {
  id: string;
  categoryId: string;
  key: string;
  labelUk: string;
  dataType: 'string' | 'number' | 'boolean' | 'enum' | 'multi_enum' | 'range';
  enumOptions: { values?: string[] } | null;
  isRequired: boolean;
  isFilterable: boolean;
  sortOrder: number;
}

export interface CategoryDetail extends Category {
  attributes: CategoryAttribute[];
}

export interface ListingAttributeValue {
  id: string;
  categoryAttributeId: string;
  value: unknown;
}

export interface Listing {
  id: string;
  userId: string;
  categoryId: string;
  listingType: ListingType;
  title: string;
  description: string | null;
  price: number | null;
  currency: string;
  isNegotiable: boolean;
  condition: 'new' | 'used' | 'for_parts' | null;
  locationId: string | null;
  status: ListingStatus;
  viewsCount: number;
  publishedAt: string | null;
  createdAt: string;
  attributes: ListingAttributeValue[];
}

export interface Media {
  id: string;
  listingId: string;
  isMain: boolean;
  sortOrder: number;
  url: string;
}

export interface SearchResultItem {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  categoryId: string;
  locationId: string | null;
  publishedAt: string | null;
  mainMediaId: string | null;
  mainMediaUrl: string | null;
}

export interface SearchResult {
  items: SearchResultItem[];
  nextCursor: string | null;
}

export interface SearchParams {
  q?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  condition?: string;
  hasPhoto?: boolean;
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc';
  cursor?: string;
  limit?: number;
}

export interface AuthUser {
  id: string;
  role: string;
  phone: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface Me {
  id: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
}

// ---- Public read endpoints ----

export function getCategoryTree(): Promise<Category[]> {
  return apiFetch('/categories');
}

export function getCategoryBySlug(slug: string): Promise<CategoryDetail> {
  return apiFetch(`/categories/${slug}`);
}

export function getCategoryAttributes(categoryId: string): Promise<CategoryAttribute[]> {
  return apiFetch(`/categories/${categoryId}/attributes`);
}

export function getListing(id: string, token?: string): Promise<Listing> {
  return apiFetch(`/listings/${id}`, { token });
}

export function getListingMedia(id: string): Promise<Media[]> {
  return apiFetch(`/listings/${id}/media`);
}

export function search(params: SearchParams): Promise<SearchResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.priceMin !== undefined) qs.set('priceMin', String(params.priceMin));
  if (params.priceMax !== undefined) qs.set('priceMax', String(params.priceMax));
  if (params.condition) qs.set('condition', params.condition);
  if (params.hasPhoto) qs.set('hasPhoto', 'true');
  if (params.sort) qs.set('sort', params.sort);
  if (params.cursor) qs.set('cursor', params.cursor);
  if (params.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/search${suffix}`);
}

// ---- Auth ----

export function requestOtp(phone: string): Promise<{ requested: true }> {
  return apiFetch('/auth/otp/request', { method: 'POST', body: { phone } });
}

export function verifyOtp(phone: string, code: string): Promise<AuthTokens> {
  return apiFetch('/auth/otp/verify', { method: 'POST', body: { phone, code } });
}

export function getMe(token: string): Promise<Me> {
  return apiFetch('/auth/me', { token });
}
