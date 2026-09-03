const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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
 * Access token живе 15 хв — без /auth/refresh (нижче) будь-який запит рано чи пізно повернув
 * би 401 і AuthProvider одразу скидав би сесію, попри те, що 30-денний refreshToken ще
 * валідний. onUnauthorized лишається "останньою лінією" — спрацьовує лише якщо сам
 * refreshToken теж уже недійсний (сплив або відкликаний блокуванням юзера).
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

interface AuthTokenHandlers {
  getRefreshToken: () => string | null;
  onTokensRefreshed: (accessToken: string, refreshToken: string) => void;
}
let authTokenHandlers: AuthTokenHandlers | null = null;
export function setAuthTokenHandlers(handlers: AuthTokenHandlers | null) {
  authTokenHandlers = handlers;
}

/** Дедуп: кілька паралельних 401 (напр. Promise.all на сторінці) не мають бити /auth/refresh кілька разів — другий виклик отримав би вже "з'їдений" ротацією refreshToken. */
let refreshInFlight: Promise<string | null> | null = null;
async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = authTokenHandlers?.getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const tokens = await apiFetch<AuthTokens>('/auth/refresh', { method: 'POST', body: { refreshToken } });
      authTokenHandlers?.onTokensRefreshed(tokens.accessToken, tokens.refreshToken);
      return tokens.accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  body?: unknown;
  /**
   * ISR: скільки секунд Next може віддавати кешовану відповідь замість похідного fetch.
   * За замовчуванням nema — усе лишається `cache: 'no-store'`, як і було. Опт-ін лише для
   * чистих (без побічних ефектів) публічних GET, які викликаються із Server Component —
   * client-side виклики цей режим Next.js Data Cache однаково не використовують.
   */
  revalidate?: number;
}

async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
  isRetryAfterRefresh = false,
): Promise<T> {
  const { token, body, headers, revalidate, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...(revalidate !== undefined
      ? { next: { revalidate } }
      : { cache: 'no-store' }),
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // token означає "це був автентифікований запит" — лише тоді має сенс пробувати
    // /auth/refresh. isRetryAfterRefresh запобігає циклу, якщо оновлений accessToken
    // чомусь одразу теж дає 401 (не має траплятись, але без цього був би нескінченний ретрай).
    if (res.status === 401 && token && !isRetryAfterRefresh) {
      const newAccessToken = await tryRefreshAccessToken();
      if (newAccessToken) {
        return apiFetch<T>(path, { ...options, token: newAccessToken }, true);
      }
    }

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

/**
 * Той самий набір, що PUBLICLY_VISIBLE_LISTING_STATUSES у listing.constants.ts на бекенді.
 * `/listings/[id]` — server component, не має доступу до localStorage-токена (auth-context.tsx),
 * тож для будь-якого іншого статусу бекенд поверне 404 навіть власнику/адміну — лінк має вести
 * на `/listings/[id]/edit` (client-компонент, шле токен) замість публічної сторінки.
 */
const PUBLICLY_VISIBLE_LISTING_STATUSES: ListingStatus[] = ['ACTIVE', 'RESERVED', 'SOLD'];
export function listingDetailHref(listing: { id: string; status: ListingStatus }): string {
  return PUBLICLY_VISIBLE_LISTING_STATUSES.includes(listing.status)
    ? `/listings/${listing.id}`
    : `/listings/${listing.id}/edit`;
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

export function getCities(revalidate?: number): Promise<City[]> {
  return apiFetch('/locations/cities', { revalidate });
}

export interface Region {
  id: string;
  nameUk: string;
  slug: string;
  cities: City[];
}

export function getRegions(revalidate?: number): Promise<Region[]> {
  return apiFetch('/locations/regions', { revalidate });
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

export function getCategoryTree(revalidate?: number): Promise<Category[]> {
  return apiFetch('/categories', { revalidate });
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
  /** null для анонімного запиту або якщо продавець вимкнув acceptsCalls — тоді лишається лише чат. */
  phone: string | null;
  acceptsCalls: boolean;
  /** Безпечний сигнал довіри — сам номер може бути прихований, але цей булевий прапорець видно завжди. */
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
  acceptsCalls: boolean;
}

export function getMyProfile(token: string): Promise<MyProfile> {
  return apiFetch('/profiles/me', { token });
}

export interface UpdateProfileDto {
  displayName?: string;
  username?: string;
  cityLocationId?: string;
  bio?: string;
  avatarMediaId?: string;
  acceptsCalls?: boolean;
}

export function updateProfile(dto: UpdateProfileDto, token: string): Promise<MyProfile> {
  return apiFetch('/profiles/me', { method: 'PATCH', body: dto, token });
}

export async function uploadAvatar(file: File, token: string): Promise<MyProfile> {
  const form = new FormData();
  form.append('file', file);

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

export function search(
  params: SearchParams,
  revalidate?: number,
): Promise<SearchResult> {
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
  return apiFetch(`/search${suffix}`, { revalidate });
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

export function getMe(token: string): Promise<Me> {
  return apiFetch('/auth/me', { token });
}

/** Профіль → "Додати номер телефону" — добровільна прив'язка до вже автентифікованого юзера. */
export function requestPhoneLink(phone: string, token: string): Promise<{ requested: true }> {
  return apiFetch('/auth/phone/request', { method: 'POST', body: { phone }, token });
}

export function linkPhone(phone: string, code: string, token: string): Promise<{ phone: string }> {
  return apiFetch('/auth/phone/link', { method: 'POST', body: { phone, code }, token });
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

export function publishListing(id: string, token: string): Promise<Listing> {
  return apiFetch(`/listings/${id}/publish`, { method: 'POST', token });
}

/** "Оновити" — продовжує термін дії оголошення ще на 30 днів (і повертає з EXPIRED в ACTIVE). */
export function renewListing(id: string, token: string): Promise<Listing> {
  return apiFetch(`/listings/${id}/renew`, { method: 'POST', token });
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
  /** Антифрод: текст згадує Telegram/Viber/WhatsApp — показати попередження в UI. */
  containsExternalContact: boolean;
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

// ---- Moderation (moderator/admin) ----

export type ModerationCaseStatus =
  'PENDING' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED';
export type ModerationDecision = 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW';

export interface ModerationQueueItem {
  id: string;
  listingId: string;
  status: ModerationCaseStatus;
  autoFlagReason: string | null;
  moderatorId: string | null;
  decidedAt: string | null;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    price: number | null;
    currency: string;
    userId: string;
    status: ListingStatus;
    ownerRiskScore: number;
  } | null;
}

export function getModerationQueue(
  token: string,
  status?: ModerationCaseStatus,
): Promise<ModerationQueueItem[]> {
  const qs = status ? `?status=${status}` : '';
  return apiFetch(`/admin/moderation/queue${qs}`, { token });
}

export function decideModerationCase(
  caseId: string,
  decision: ModerationDecision,
  token: string,
): Promise<ModerationQueueItem> {
  return apiFetch(`/admin/moderation/${caseId}/decide`, {
    method: 'POST',
    body: { decision },
    token,
  });
}

// ---- Admin: users (block/unblock) ----

export interface AdminUserView {
  id: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
  /** null = типовий ліміт активних оголошень; адмін підвищує вручну для пілотних продавців. */
  maxActiveListingsOverride: number | null;
}

export function searchAdminUsers(
  token: string,
  search?: string,
): Promise<AdminUserView[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiFetch(`/admin/users${qs}`, { token });
}

export interface AdminUserDetail extends AdminUserView {
  profile: PublicProfile;
  listings: {
    id: string;
    title: string;
    status: ListingStatus;
    price: number | null;
    currency: string;
    createdAt: string;
  }[];
  reports: {
    id: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    status: ReportStatus;
    createdAt: string;
  }[];
  riskScore: number;
  riskSignals: {
    id: string;
    signalType: string;
    weight: number;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }[];
}

export function getAdminUserDetail(
  id: string,
  token: string,
): Promise<AdminUserDetail> {
  return apiFetch(`/admin/users/${id}`, { token });
}

export function blockUser(
  userId: string,
  token: string,
): Promise<AdminUserView> {
  return apiFetch(`/admin/users/${userId}/block`, { method: 'POST', token });
}

export function unblockUser(
  userId: string,
  token: string,
): Promise<AdminUserView> {
  return apiFetch(`/admin/users/${userId}/unblock`, { method: 'POST', token });
}

/** value: null скидає до типового ліміту (SettingsService.getMaxActiveListingsPerUser). */
export function setMaxActiveListingsOverride(
  userId: string,
  value: number | null,
  token: string,
): Promise<AdminUserView> {
  return apiFetch(`/admin/users/${userId}/max-active-listings`, { method: 'POST', body: { value }, token });
}

// ---- Admin: audit log ----

export interface AuditLogEntry {
  id: string;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  targetType?: string;
  action?: string;
  actorUserId?: string;
}

export function getAuditLog(
  token: string,
  filters?: AuditLogFilters,
): Promise<AuditLogEntry[]> {
  const qs = new URLSearchParams();
  if (filters?.targetType) qs.set('targetType', filters.targetType);
  if (filters?.action) qs.set('action', filters.action);
  if (filters?.actorUserId) qs.set('actorUserId', filters.actorUserId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/admin/audit-log${suffix}`, { token });
}

// ---- Admin: dashboard ----

export interface DashboardMetrics {
  users: { total: number; active: number; blocked: number };
  listings: { total: number; byStatus: Record<ListingStatus, number>; bySellerType: Record<SellerType, number> };
  moderation: { pending: number; needsReview: number };
  reports: { pending: number; reviewing: number };
  riskFlaggedUsers: number;
}

export function getDashboardMetrics(token: string): Promise<DashboardMetrics> {
  return apiFetch('/admin/dashboard', { token });
}

// ---- Admin: listings (search/view/edit/block) ----

export interface AdminUpdateListingDto {
  status?: 'ACTIVE' | 'BLOCKED';
  title?: string;
  description?: string;
  price?: number;
  currency?: string;
}

export function searchAdminListings(
  token: string,
  search?: string,
  status?: ListingStatus,
): Promise<Listing[]> {
  const qs = new URLSearchParams();
  if (search) qs.set('search', search);
  if (status) qs.set('status', status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/admin/listings${suffix}`, { token });
}

export function updateAdminListing(
  id: string,
  dto: AdminUpdateListingDto,
  token: string,
): Promise<Listing> {
  return apiFetch(`/admin/listings/${id}`, {
    method: 'PATCH',
    body: dto,
    token,
  });
}

// ---- Admin: categories & attributes (CRUD) ----

export function getAdminCategoryTree(token: string): Promise<Category[]> {
  return apiFetch('/admin/categories', { token });
}

export interface CreateCategoryDto {
  nameUk: string;
  slug: string;
  parentId?: string | null;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateCategoryDto = Partial<CreateCategoryDto>;

export function createCategory(
  dto: CreateCategoryDto,
  token: string,
): Promise<Category> {
  return apiFetch('/admin/categories', { method: 'POST', body: dto, token });
}

export function updateCategory(
  id: string,
  dto: UpdateCategoryDto,
  token: string,
): Promise<Category> {
  return apiFetch(`/admin/categories/${id}`, {
    method: 'PATCH',
    body: dto,
    token,
  });
}

export function deleteCategory(id: string, token: string): Promise<void> {
  return apiFetch(`/admin/categories/${id}`, { method: 'DELETE', token });
}

export interface CreateAttributeDto {
  key: string;
  labelUk: string;
  dataType: CategoryAttribute['dataType'];
  enumOptions?: Record<string, unknown>;
  isRequired?: boolean;
  isFilterable?: boolean;
  sortOrder?: number;
}

export function createCategoryAttribute(
  categoryId: string,
  dto: CreateAttributeDto,
  token: string,
): Promise<CategoryAttribute> {
  return apiFetch(`/admin/categories/${categoryId}/attributes`, {
    method: 'POST',
    body: dto,
    token,
  });
}

export function updateCategoryAttribute(
  id: string,
  dto: Partial<CreateAttributeDto>,
  token: string,
): Promise<CategoryAttribute> {
  return apiFetch(`/admin/attributes/${id}`, {
    method: 'PATCH',
    body: dto,
    token,
  });
}

// ---- Admin: reports (moderator/admin) ----

export function getAdminReports(
  token: string,
  status?: ReportStatus,
  targetType?: ReportTargetType,
): Promise<Report[]> {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (targetType) qs.set('targetType', targetType);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch(`/admin/reports${suffix}`, { token });
}

export type ReportResolutionStatus = 'REVIEWING' | 'RESOLVED' | 'REJECTED';

export function resolveReport(
  id: string,
  status: ReportResolutionStatus,
  token: string,
): Promise<Report> {
  return apiFetch(`/admin/reports/${id}/resolve`, {
    method: 'POST',
    body: { status },
    token,
  });
}

/** multipart/form-data — не через apiFetch (той завжди серіалізує body в JSON). */
export async function uploadListingMedia(
  listingId: string,
  file: File,
  token: string,
): Promise<Media> {
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
