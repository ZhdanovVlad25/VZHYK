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

export interface PublicProfile {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarMediaId: string | null;
  cityLocationId: string | null;
  bio: string | null;
  rating: number | null;
  reviewsCount: number | null;
  activeListingsCount: number;
  memberSince: string;
}

export function getPublicProfile(userId: string): Promise<PublicProfile> {
  return apiFetch(`/users/${userId}/public-profile`);
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

// ---- Listings (authenticated mutations) ----

export interface AttributeValueInput {
  categoryAttributeId: string;
  value: unknown;
}

export interface CreateListingDto {
  categoryId: string;
  listingType: ListingType;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  isNegotiable?: boolean;
  condition?: 'new' | 'used' | 'for_parts';
  attributes?: AttributeValueInput[];
}

export type UpdateListingDto = Partial<Omit<CreateListingDto, 'categoryId'>>;

export function createListing(dto: CreateListingDto, token: string): Promise<Listing> {
  return apiFetch('/listings', { method: 'POST', body: dto, token });
}

export function updateListing(id: string, dto: UpdateListingDto, token: string): Promise<Listing> {
  return apiFetch(`/listings/${id}`, { method: 'PATCH', body: dto, token });
}

export function publishListing(id: string, token: string): Promise<Listing> {
  return apiFetch(`/listings/${id}/publish`, { method: 'POST', token });
}

export function getMyListings(token: string, status?: ListingStatus): Promise<Listing[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch(`/profiles/me/listings${qs}`, { token });
}

// ---- Favorites ----

export interface FavoriteView {
  id: string;
  listingId: string;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    price: number | null;
    currency: string;
    status: string;
  };
  isUnavailable: boolean;
  priceChanged: boolean;
}

export function getFavorites(token: string): Promise<FavoriteView[]> {
  return apiFetch('/favorites', { token });
}

export function addFavorite(listingId: string, token: string): Promise<{ id: string; listingId: string }> {
  return apiFetch(`/favorites/${listingId}`, { method: 'POST', token });
}

export function removeFavorite(listingId: string, token: string): Promise<void> {
  return apiFetch(`/favorites/${listingId}`, { method: 'DELETE', token });
}

// ---- Saved searches ----

export interface SavedSearch {
  id: string;
  queryText: string | null;
  categoryId: string | null;
  filters: Record<string, unknown> | null;
  regionLocationId: string | null;
  createdAt: string;
}

export interface CreateSavedSearchDto {
  queryText?: string;
  categoryId?: string;
  filters?: Record<string, unknown>;
  regionLocationId?: string;
}

export function getSavedSearches(token: string): Promise<SavedSearch[]> {
  return apiFetch('/saved-searches', { token });
}

export function createSavedSearch(dto: CreateSavedSearchDto, token: string): Promise<SavedSearch> {
  return apiFetch('/saved-searches', { method: 'POST', body: dto, token });
}

export function deleteSavedSearch(id: string, token: string): Promise<void> {
  return apiFetch(`/saved-searches/${id}`, { method: 'DELETE', token });
}

// ---- Chat ----

export interface ChatDto {
  id: string;
  listingId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatListItem {
  chatId: string;
  listingId: string | null;
  otherUserId: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  mediaIds: string[];
  createdAt: string;
  readAt: string | null;
}

export interface MessagesPage {
  items: Message[];
  nextCursor: string | null;
}

export function createChat(otherUserId: string, listingId: string | undefined, token: string): Promise<ChatDto> {
  return apiFetch('/chats', { method: 'POST', body: { otherUserId, listingId }, token });
}

export function listChats(token: string): Promise<ChatListItem[]> {
  return apiFetch('/chats', { token });
}

export function getChatMessages(chatId: string, token: string, cursor?: string): Promise<MessagesPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiFetch(`/chats/${chatId}/messages${qs}`, { token });
}

export function sendChatMessage(chatId: string, text: string, token: string): Promise<Message> {
  return apiFetch(`/chats/${chatId}/messages`, { method: 'POST', body: { text }, token });
}

export function blockChat(chatId: string, token: string): Promise<void> {
  return apiFetch(`/chats/${chatId}/block`, { method: 'POST', token });
}

// ---- Reports ----

export type ReportTargetType = 'LISTING' | 'USER' | 'CHAT';
export type ReportReason = 'SPAM' | 'FRAUD' | 'PROHIBITED_ITEM' | 'OFFENSIVE_CONTENT' | 'DUPLICATE' | 'OTHER';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
}

export interface CreateReportDto {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string;
}

export function createReport(dto: CreateReportDto, token: string): Promise<Report> {
  return apiFetch('/reports', { method: 'POST', body: dto, token });
}

export function getMyReports(token: string): Promise<Report[]> {
  return apiFetch('/reports/mine', { token });
}

/** multipart/form-data — не через apiFetch (той завжди серіалізує body в JSON). */
export async function uploadListingMedia(listingId: string, file: File, token: string): Promise<Media> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}/listings/${listingId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'UNKNOWN_ERROR', err.message ?? res.statusText, err.details ?? null);
  }
  return json as Media;
}
