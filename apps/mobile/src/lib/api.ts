const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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

/**
 * Access token живе 15 хв без автопродовження (auth-context.tsx) — рано чи пізно будь-який
 * запит поверне 401. AuthProvider підписується сюди, щоб одразу скинути стару сесію.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: unknown;
}

async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { token, body, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const err = json?.error ?? {};
    if (res.status === 401) {
      onUnauthorized?.();
    }
    throw new ApiError(
      res.status,
      err.code ?? 'UNKNOWN_ERROR',
      err.message ?? res.statusText,
      err.details ?? null,
    );
  }

  return json as T;
}

/** Файл із expo-image-picker: RN FormData приймає { uri, name, type } замість браузерного File. */
export interface RNFile {
  uri: string;
  name: string;
  type: string;
}

// ---- Types ----

export type ListingType =
  'sell' | 'buy' | 'exchange' | 'give_away' | 'service' | 'rent' | 'vacancy' | 'resume';
export type SellerType = 'private' | 'business';
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

const PUBLICLY_VISIBLE_LISTING_STATUSES: ListingStatus[] = ['ACTIVE', 'RESERVED', 'SOLD'];
export function isPubliclyVisibleListing(status: ListingStatus): boolean {
  return PUBLICLY_VISIBLE_LISTING_STATUSES.includes(status);
}

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
  expiresAt: string | null;
  autoRenew: boolean;
  sellerType: SellerType;
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
  listingType: ListingType;
  locationId: string | null;
  locationName: string | null;
  publishedAt: string | null;
  mainMediaId: string | null;
  mainMediaUrl: string | null;
}

export interface SearchResult {
  items: SearchResultItem[];
  nextCursor: string | null;
  total: number;
}

export interface City {
  id: string;
  nameUk: string;
  slug: string;
}

export function getCities(): Promise<City[]> {
  return apiFetch('/locations/cities');
}

export interface Region {
  id: string;
  nameUk: string;
  slug: string;
  cities: City[];
}

export function getRegions(): Promise<Region[]> {
  return apiFetch('/locations/regions');
}

export interface SearchParams {
  q?: string;
  category?: string;
  location?: string;
  seller?: string;
  priceMin?: number;
  priceMax?: number;
  condition?: string;
  listingType?: string;
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

export function getCategoryAttributes(
  categoryId: string,
): Promise<CategoryAttribute[]> {
  return apiFetch(`/categories/${categoryId}/attributes`);
}

export interface CategorySuggestion {
  topCategoryId: string;
  topCategoryName: string;
  subCategoryId: string | null;
  subCategoryName: string | null;
}

export function suggestCategory(title: string): Promise<CategorySuggestion | null> {
  return apiFetch(`/categories/suggest?title=${encodeURIComponent(title)}`);
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
  avatarUrl: string | null;
  rating: number | null;
  reviewsCount: number | null;
  activeListingsCount: number;
  memberSince: string;
  lastActiveAt: string | null;
  /** null для анонімного запиту — бекенд віддає реальний номер лише авторизованим. */
  phone: string | null;
  /** Чи продавець приймає дзвінки (окремо від наявності phone) — власний вибір продавця. */
  acceptsCalls: boolean;
  /** Кожен телефон на платформі верифікований через OTP при прив'язці — сам факт наявності це й означає. */
  phoneVerified: boolean;
}

export function getPublicProfile(userId: string, token?: string): Promise<PublicProfile> {
  return apiFetch(`/users/${userId}/public-profile`, { token });
}

export interface MyProfile {
  id: string;
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarMediaId: string | null;
  avatarUrl: string | null;
  cityLocationId: string | null;
  bio: string | null;
}

export function getMyProfile(token: string): Promise<MyProfile> {
  return apiFetch('/profiles/me', { token });
}

export interface ProfileStats {
  totalListingsCount: number;
  activeListingsCount: number;
  totalViewsCount: number;
  favoritesCount: number;
  memberSince: string;
}

export function getMyProfileStats(token: string): Promise<ProfileStats> {
  return apiFetch('/profiles/me/stats', { token });
}

export interface UpdateProfileDto {
  displayName?: string;
  username?: string;
  cityLocationId?: string;
  bio?: string;
  avatarMediaId?: string;
}

export function updateProfile(dto: UpdateProfileDto, token: string): Promise<MyProfile> {
  return apiFetch('/profiles/me', { method: 'PATCH', body: dto, token });
}

export async function uploadAvatar(file: RNFile, token: string): Promise<MyProfile> {
  const form = new FormData();
  form.append('file', file as unknown as Blob);

  const res = await fetch(`${API_URL}/profiles/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? {};
    if (res.status === 401) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, err.code ?? 'UNKNOWN_ERROR', err.message ?? res.statusText, err.details ?? null);
  }
  return json as MyProfile;
}

export function getListingMedia(id: string): Promise<Media[]> {
  return apiFetch(`/listings/${id}/media`);
}

/** isMain: true — робить це фото головним (бекенд сам знімає isMain з решти фото оголошення). */
export function updateListingMedia(
  listingId: string,
  mediaId: string,
  dto: { isMain?: boolean; sortOrder?: number },
  token: string,
): Promise<Media> {
  return apiFetch(`/listings/${listingId}/media/${mediaId}`, { method: 'PATCH', body: dto, token });
}

export function search(params: SearchParams): Promise<SearchResult> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.location) qs.set('location', params.location);
  if (params.seller) qs.set('seller', params.seller);
  if (params.priceMin !== undefined)
    qs.set('priceMin', String(params.priceMin));
  if (params.priceMax !== undefined)
    qs.set('priceMax', String(params.priceMax));
  if (params.condition) qs.set('condition', params.condition);
  if (params.listingType) qs.set('listingType', params.listingType);
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
  return apiFetch('/auth/otp/verify', {
    method: 'POST',
    body: { phone, code },
  });
}

/** Google-вхід через expo-auth-session — надсилаємо готовий ID-токен, бекенд сам його перевіряє. */
export function loginWithGoogleIdToken(idToken: string): Promise<AuthTokens> {
  return apiFetch('/auth/google/mobile', {
    method: 'POST',
    body: { idToken },
  });
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
  locationId?: string;
  attributes?: AttributeValueInput[];
  autoRenew?: boolean;
  sellerType: SellerType;
}

export type UpdateListingDto = Partial<Omit<CreateListingDto, 'categoryId'>>;

export function createListing(
  dto: CreateListingDto,
  token: string,
): Promise<Listing> {
  return apiFetch('/listings', { method: 'POST', body: dto, token });
}

export function updateListing(
  id: string,
  dto: UpdateListingDto,
  token: string,
): Promise<Listing> {
  return apiFetch(`/listings/${id}`, { method: 'PATCH', body: dto, token });
}

/** "Оновити" — продовжує термін дії оголошення ще на 30 днів (і повертає з EXPIRED в ACTIVE). */
export function renewListing(id: string, token: string): Promise<Listing> {
  return apiFetch(`/listings/${id}/renew`, { method: 'POST', token });
}

export function publishListing(id: string, token: string): Promise<Listing> {
  return apiFetch(`/listings/${id}/publish`, { method: 'POST', token });
}

export function getMyListings(
  token: string,
  status?: ListingStatus,
): Promise<Listing[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch(`/profiles/me/listings${qs}`, { token });
}

export function deleteListing(id: string, token: string): Promise<void> {
  return apiFetch(`/listings/${id}`, { method: 'DELETE', token });
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

export function addFavorite(
  listingId: string,
  token: string,
): Promise<{ id: string; listingId: string }> {
  return apiFetch(`/favorites/${listingId}`, { method: 'POST', token });
}

export function removeFavorite(
  listingId: string,
  token: string,
): Promise<void> {
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

export function createSavedSearch(
  dto: CreateSavedSearchDto,
  token: string,
): Promise<SavedSearch> {
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
  listingUserId: string | null;
  otherUserId: string | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
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

export function createChat(
  otherUserId: string,
  listingId: string | undefined,
  token: string,
): Promise<ChatDto> {
  return apiFetch('/chats', {
    method: 'POST',
    body: { otherUserId, listingId },
    token,
  });
}

export function listChats(token: string): Promise<ChatListItem[]> {
  return apiFetch('/chats', { token });
}

export function getChatMessages(
  chatId: string,
  token: string,
  cursor?: string,
): Promise<MessagesPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiFetch(`/chats/${chatId}/messages${qs}`, { token });
}

export function sendChatMessage(
  chatId: string,
  text: string,
  token: string,
): Promise<Message> {
  return apiFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: { text },
    token,
  });
}

export function blockChat(chatId: string, token: string): Promise<void> {
  return apiFetch(`/chats/${chatId}/block`, { method: 'POST', token });
}

// ---- Reports ----

export type ReportTargetType = 'LISTING' | 'USER' | 'CHAT';
export type ReportReason =
  | 'SPAM'
  | 'FRAUD'
  | 'PROHIBITED_ITEM'
  | 'OFFENSIVE_CONTENT'
  | 'DUPLICATE'
  | 'OTHER';
export type ReportStatus = 'PENDING' | 'REVIEWING' | 'RESOLVED' | 'REJECTED';

export interface Report {
  id: string;
  reporterId: string;
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

export function createReport(
  dto: CreateReportDto,
  token: string,
): Promise<Report> {
  return apiFetch('/reports', { method: 'POST', body: dto, token });
}

export function getMyReports(token: string): Promise<Report[]> {
  return apiFetch('/reports/mine', { token });
}

/** multipart/form-data — не через apiFetch (той завжди серіалізує body в JSON). */
export async function uploadListingMedia(
  listingId: string,
  file: RNFile,
  token: string,
): Promise<Media> {
  const form = new FormData();
  form.append('file', file as unknown as Blob);

  const res = await fetch(`${API_URL}/listings/${listingId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? {};
    if (res.status === 401) {
      onUnauthorized?.();
    }
    throw new ApiError(
      res.status,
      err.code ?? 'UNKNOWN_ERROR',
      err.message ?? res.statusText,
      err.details ?? null,
    );
  }
  return json as Media;
}
