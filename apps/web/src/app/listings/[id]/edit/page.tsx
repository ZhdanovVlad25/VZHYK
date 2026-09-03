'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  deleteListingMedia,
  getCategoryAttributes,
  getCategoryTree,
  getCities,
  getListing,
  getListingMedia,
  getRegions,
  publishListing,
  renewListing,
  updateListing,
  updateListingMedia,
  uploadListingMedia,
  type Category,
  type CategoryAttribute,
  type City,
  type Listing,
  type ListingType,
  type Media,
  type Region,
  type SellerType,
} from '@/lib/api';
import { AttributeFields, type AttributeValues } from '@/components/listings/AttributeFields';
import { AutoRenewToggle } from '@/components/listings/AutoRenewToggle';
import { SellerTypeToggle } from '@/components/listings/SellerTypeToggle';
import { Alert, Badge, Button, Card, Dropdown, ErrorState, Form, Input, LoadingState, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { getConditionOptions } from '@/lib/listing-condition';
import { getListingTypeLabel, getListingTypeOptions } from '@/lib/listing-type';

const PRICE_OPTIONAL_TYPES = new Set<ListingType>(['buy', 'give_away', 'vacancy', 'resume']);

const TITLE_MIN_LENGTH = 5;
const DESCRIPTION_MIN_LENGTH = 10;

const CURRENCY_OPTIONS = [
  { value: 'UAH', label: 'грн' },
  { value: 'USD', label: '$' },
  { value: 'EUR', label: '€' },
];

/** Ціна не може бути відʼємною — прибираємо будь-який "-" одразу при вводі, а не лише min на спінері (той не блокує ручний ввід "-6"). */
function sanitizeNonNegative(raw: string): string {
  return raw.replace(/-/g, '');
}

const NOT_EDITABLE_STATUSES = ['SOLD', 'ARCHIVED', 'BLOCKED'];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Чернетка',
  PENDING_MODERATION: 'На модерації',
  ACTIVE: 'Активне',
  REJECTED: 'Відхилено',
  RESERVED: 'Зарезервовано',
  SOLD: 'Продано',
  EXPIRED: 'Термін минув',
  ARCHIVED: 'В архіві',
  BLOCKED: 'Заблоковано',
};

function findCategoryLabel(categories: Category[], id: string, prefix = ''): string | null {
  for (const c of categories) {
    const label = prefix ? `${prefix} → ${c.nameUk}` : c.nameUk;
    if (c.id === id) return label;
    const found = findCategoryLabel(c.children, id, label);
    if (found) return found;
  }
  return null;
}

function findCategorySlug(categories: Category[], id: string): string | null {
  for (const c of categories) {
    if (c.id === id) return c.slug;
    const found = findCategorySlug(c.children, id);
    if (found) return found;
  }
  return null;
}

export default function EditListingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveStatusRef = useRef<HTMLDivElement>(null);

  const [listing, setListing] = useState<Listing | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [settingMainMediaId, setSettingMainMediaId] = useState<string | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isSavingAutoRenew, setIsSavingAutoRenew] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [listingType, setListingType] = useState<ListingType>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('UAH');
  const [condition, setCondition] = useState<string | null>(null);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [sellerType, setSellerType] = useState<SellerType | null>(null);
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({});
  const [cities, setCities] = useState<City[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Захист від оновлення стану після того, як компонент уже розмонтований (користувач
  // швидко пішов зі сторінки, поки load()/getCities()/getRegions() ще виконувались) —
  // без цього React у dev-режимі лише попереджає в консоль, але в проді може лишити
  // сторінку в суперечливому напівоновленому DOM-стані.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [listingResult, mediaResult, categories] = await Promise.all([
        getListing(params.id, accessToken),
        getListingMedia(params.id),
        getCategoryTree(),
      ]);
      if (!isMountedRef.current) return;
      setListing(listingResult);
      setMedia(mediaResult);
      setCategoryLabel(findCategoryLabel(categories, listingResult.categoryId));
      setCategorySlug(findCategorySlug(categories, listingResult.categoryId));

      setListingType(listingResult.listingType);
      setTitle(listingResult.title);
      setDescription(listingResult.description ?? '');
      setPrice(listingResult.price === null ? '' : String(listingResult.price));
      setCurrency(listingResult.currency);
      setCondition(listingResult.condition);
      setIsNegotiable(listingResult.isNegotiable);
      setSellerType(listingResult.sellerType);
      setLocationId(listingResult.locationId);
      setAttributeValues(Object.fromEntries(listingResult.attributes.map((a) => [a.categoryAttributeId, a.value])));

      const attrs = await getCategoryAttributes(listingResult.categoryId);
      if (!isMountedRef.current) return;
      setCategoryAttributes(attrs);
    } catch (err) {
      if (!isMountedRef.current) return;
      setLoadError(err instanceof ApiError ? err.message : 'Не вдалося завантажити оголошення.');
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [params.id, accessToken]);

  useEffect(() => {
    if (accessToken) {
      load();
    }
  }, [accessToken, load]);

  useEffect(() => {
    getCities()
      .then((c) => isMountedRef.current && setCities(c))
      .catch(() => isMountedRef.current && setCities([]));
    getRegions()
      .then((r) => isMountedRef.current && setRegions(r))
      .catch(() => isMountedRef.current && setRegions([]))
      .finally(() => isMountedRef.current && setIsLoadingRegions(false));
  }, []);

  // Одноразово підтягує область для вже збереженого міста оголошення (locationId
  // приходить з load(), regions — окремим fetch'ем; коли обидва готові, знаходимо
  // батьківську область). Подальші ручні зміни regionId/locationId через дропдауни
  // цей ефект не чіпають (locationId одразу null при зміні області — guard нижче).
  useEffect(() => {
    if (!locationId || regions.length === 0) return;
    const parentRegion = regions.find((r) => r.cities.some((c) => c.id === locationId));
    if (parentRegion) setRegionId(parentRegion.id);
  }, [locationId, regions]);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.id === regionId) ?? null,
    [regions, regionId],
  );
  const citiesInRegion = selectedRegion?.cities ?? [];

  const isEditable = useMemo(() => (listing ? !NOT_EDITABLE_STATUSES.includes(listing.status) : false), [listing]);
  // Бекенд (findVisible) тепер пускає сюди й модератора/адміна на чуже оголошення, що ще не
  // на публічному статусі (docs/moderation.md §4 — треба бачити зміст ДО рішення в черзі).
  // Це не власник, тож форма редагування недоречна — лише перегляд, без Save/Publish/Upload.
  const isOwner = Boolean(user) && Boolean(listing) && listing?.userId === user?.id;

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !accessToken || !listing) return;
    setActionError(null);
    setIsUploading(true);
    const wasActive = listing.status === 'ACTIVE';
    try {
      for (const file of Array.from(files)) {
        await uploadListingMedia(params.id, file, accessToken);
      }
      const [fresh, freshListing] = await Promise.all([getListingMedia(params.id), getListing(params.id, accessToken)]);
      setMedia(fresh);
      // Нове фото на ACTIVE оголошенні теж повертає на модерацію (media.service.ts upload()) —
      // без перезавантаження listing тут статус-бейдж лишався б застарілим до наступного refresh.
      setListing(freshListing);
      if (wasActive && freshListing.status === 'PENDING_MODERATION') {
        setSaveMessage('Фото додано. Оголошення знову на модерації.');
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося завантажити фото.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSetMainMedia(mediaId: string) {
    if (!accessToken) return;
    setActionError(null);
    setSettingMainMediaId(mediaId);
    try {
      await updateListingMedia(params.id, mediaId, { isMain: true }, accessToken);
      setMedia((prev) => prev.map((m) => ({ ...m, isMain: m.id === mediaId })));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося зробити фото головним.');
    } finally {
      setSettingMainMediaId(null);
    }
  }

  async function handleDeleteMedia(mediaId: string) {
    if (!accessToken) return;
    if (media.length <= 1) {
      setActionError('Не можна видалити останнє фото — оголошенню потрібне хоча б одне.');
      return;
    }
    if (!window.confirm('Видалити це фото?')) return;
    setActionError(null);
    setDeletingMediaId(mediaId);
    try {
      await deleteListingMedia(params.id, mediaId, accessToken);
      // Бекенд сам призначає нове головне фото, якщо видалене було головним
      // (media.service.ts remove()) — рефетч замість локального патчу, щоб не гадати, яке саме.
      setMedia(await getListingMedia(params.id));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося видалити фото.');
    } finally {
      setDeletingMediaId(null);
    }
  }

  async function handlePublish() {
    if (!accessToken) return;
    setActionError(null);
    setIsPublishing(true);
    try {
      /**
       * publish() тепер переводить у PENDING_MODERATION, не ACTIVE — редірект на
       * публічну /listings/:id зламався б (анонімний SSR-фетч не бачить непублічний
       * статус). Лишаємось тут і перезавантажуємо дані, щоб побачити нову плашку.
       */
      await publishListing(params.id, accessToken);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося опублікувати оголошення.');
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleRenew() {
    if (!accessToken) return;
    setActionError(null);
    setIsRenewing(true);
    try {
      const updated = await renewListing(params.id, accessToken);
      setListing(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося оновити термін дії.');
    } finally {
      setIsRenewing(false);
    }
  }

  async function handleToggleAutoRenew(next: boolean) {
    if (!accessToken || !listing) return;
    setIsSavingAutoRenew(true);
    try {
      const updated = await updateListing(params.id, { autoRenew: next }, accessToken);
      setListing(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося зберегти автопродовження.');
    } finally {
      setIsSavingAutoRenew(false);
    }
  }

  const isTitleValid = title.trim().length >= TITLE_MIN_LENGTH;
  const isDescriptionValid = description.trim().length >= DESCRIPTION_MIN_LENGTH;
  const canSave = isTitleValid && isDescriptionValid && Boolean(locationId) && Boolean(sellerType);

  // Кнопка "Зберегти зміни" — внизу довгої форми, а плашка результату рендериться вгорі
  // картки — без автоскролу користувач після кліку лишався дивитись на кнопку і не бачив,
  // що взагалі щось відбулось (звіт тестувальника: "натиснув зберігати внизу і нічого").
  useEffect(() => {
    if (saveMessage || saveError) {
      saveStatusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [saveMessage, saveError]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !listing || !canSave) return;
    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);
    try {
      const updated = await updateListing(
        params.id,
        {
          listingType,
          title,
          description: description || undefined,
          price: price === '' ? undefined : Number(price),
          currency,
          condition: (condition as 'new' | 'used' | 'for_parts') ?? undefined,
          locationId: locationId ?? undefined,
          isNegotiable,
          sellerType: sellerType ?? undefined,
          attributes: categoryAttributes
            .filter((attr) => attributeValues[attr.id] !== undefined && attributeValues[attr.id] !== '')
            .map((attr) => ({ categoryAttributeId: attr.id, value: attributeValues[attr.id] })),
        },
        accessToken,
      );
      // Бекенд сам повертає ACTIVE → PENDING_MODERATION при зміні контенту (listings.service.ts
      // update()) — тут лише пояснюємо це в повідомленні, щоб зміна статусу не виглядала збоєм.
      const wentBackToModeration = listing.status === 'ACTIVE' && updated.status === 'PENDING_MODERATION';
      setListing(updated);
      setSaveMessage(
        wentBackToModeration
          ? 'Збережено. Оголошення знову на модерації — зміни в опублікованому оголошенні перевіряються повторно.'
          : 'Збережено',
      );
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-700 dark:text-gray-300">
        Щоб редагувати оголошення, потрібно увійти.
      </div>
    );
  }

  if (authLoading || isLoading) {
    return <LoadingState label="Завантаження оголошення…" />;
  }

  if (loadError || !listing) {
    return <ErrorState description={loadError ?? 'Оголошення не знайдено'} onRetry={load} />;
  }

  if (!isOwner) {
    const cityName = locationId ? cities.find((c) => c.id === locationId)?.nameUk ?? null : null;
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone={listing.status === 'DRAFT' ? 'neutral' : listing.status === 'ACTIVE' ? 'success' : 'warning'}>
            {STATUS_LABELS[listing.status] ?? listing.status}
          </Badge>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{listing.title}</h1>
        </div>
        <p className="mb-4 text-xl font-extrabold text-brand-700 dark:text-brand-400">{formatPrice(listing.price, listing.currency)}</p>

        <Alert tone="info" title="Перегляд для модерації" className="mb-4">
          Це чуже оголошення — доступний лише перегляд перед рішенням у черзі модерації,
          редагування недоступне.
        </Alert>

        {media.length > 0 && (
          <Card className="mb-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Фото</h2>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {media.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL
                <img
                  key={m.id}
                  src={m.url}
                  alt=""
                  className="aspect-square w-full rounded-xl border border-gray-200 object-cover dark:border-gray-700"
                />
              ))}
            </div>
          </Card>
        )}

        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Деталі оголошення</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="contents">
              <dt className="text-gray-500 dark:text-gray-400">Категорія</dt>
              <dd className="text-gray-900 dark:text-gray-100">{categoryLabel ?? '—'}</dd>
            </div>
            <div className="contents">
              <dt className="text-gray-500 dark:text-gray-400">Тип</dt>
              <dd className="text-gray-900 dark:text-gray-100">{getListingTypeLabel(listingType)}</dd>
            </div>
            {cityName && (
              <div className="contents">
                <dt className="text-gray-500 dark:text-gray-400">Місто</dt>
                <dd className="text-gray-900 dark:text-gray-100">{cityName}</dd>
              </div>
            )}
            {condition && (
              <div className="contents">
                <dt className="text-gray-500 dark:text-gray-400">Стан</dt>
                <dd className="text-gray-900 dark:text-gray-100">
                  {condition === 'new' ? 'Новий' : condition === 'used' ? 'Вживаний' : 'На запчастини'}
                </dd>
              </div>
            )}
            {categoryAttributes
              .filter((attr) => attributeValues[attr.id] !== undefined && attributeValues[attr.id] !== '')
              .map((attr) => (
                <div key={attr.id} className="contents">
                  <dt className="text-gray-500 dark:text-gray-400">{attr.labelUk}</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{String(attributeValues[attr.id])}</dd>
                </div>
              ))}
          </dl>
          {description && <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{description}</p>}
        </Card>

        <Link href="/admin/moderation">
          <Button variant="secondary">← Назад до черги модерації</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <Badge tone={listing.status === 'DRAFT' ? 'neutral' : listing.status === 'ACTIVE' ? 'success' : 'warning'}>
          {STATUS_LABELS[listing.status] ?? listing.status}
        </Badge>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{listing.title}</h1>
      </div>
      <p className="mb-2 text-xl font-extrabold text-brand-700 dark:text-brand-400">{formatPrice(listing.price, listing.currency)}</p>

      {/* Термін дії — лише для ACTIVE/EXPIRED, для інших статусів expiresAt ще не заданий
          (виставляється при схваленні модерацією, moderation.service.ts). */}
      {(listing.status === 'ACTIVE' || listing.status === 'EXPIRED') && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {listing.expiresAt && (
              <span className="text-gray-600 dark:text-gray-400">
                {listing.status === 'EXPIRED'
                  ? 'Термін дії закінчився'
                  : `Активне до ${new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(listing.expiresAt))}`}
              </span>
            )}
            <Button size="sm" variant="secondary" isLoading={isRenewing} onClick={handleRenew}>
              Оновити
            </Button>
          </div>
          <AutoRenewToggle checked={listing.autoRenew} disabled={isSavingAutoRenew} onChange={handleToggleAutoRenew} />
        </div>
      )}

      {listing.status === 'PENDING_MODERATION' && (
        <Alert tone="info" title="На модерації" className="mb-4">
          Оголошення надіслано на розгляд модератору — форма нижче лишається доступною
          для редагування, це нормально: результат ви побачите тут же, статус зміниться
          на &quot;Активне&quot; після схвалення.
        </Alert>
      )}

      {actionError && (
        <Alert tone="danger" title="Помилка" className="mb-4">
          {actionError}
        </Alert>
      )}

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Фото</h2>
        <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {media.map((m) => (
            <div key={m.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL */}
              <img
                src={m.url}
                alt=""
                className={cn(
                  'aspect-square w-full rounded-xl border object-cover',
                  m.isMain ? 'border-2 border-brand-600 dark:border-brand-400' : 'border-gray-200 dark:border-gray-700',
                )}
              />
              {m.isMain ? (
                <span className="absolute left-1 top-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                  Головне
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSetMainMedia(m.id)}
                  disabled={settingMainMediaId !== null}
                  className="absolute inset-x-1 bottom-1 rounded-lg bg-black/60 px-1.5 py-1 text-[10px] font-medium text-white hover:bg-black/75 disabled:opacity-50"
                >
                  {settingMainMediaId === m.id ? '…' : 'Зробити головним'}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteMedia(m.id)}
                disabled={deletingMediaId !== null}
                aria-label="Видалити фото"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingMediaId === m.id ? '…' : '✕'}
              </button>
            </div>
          ))}
        </div>
        {/* Нативна кнопка file-інпуту показує текст мовою браузера (не контролюється CSS/HTML) —
            ховаємо сам input і керуємо вибором файлу через стилізовану кнопку сторінки. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelected}
          disabled={isUploading}
          className="sr-only"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          isLoading={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Додати фото
        </Button>
      </Card>

      {!isEditable ? (
        <Alert tone="warning" title="Редагування недоступне">
          Оголошення в статусі {listing.status} більше не можна редагувати.
        </Alert>
      ) : (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Деталі оголошення</h2>

          <div ref={saveStatusRef}>
            {saveMessage && (
              <Alert tone="success" className="mb-4">
                {saveMessage}
              </Alert>
            )}
            {saveError && (
              <Alert tone="danger" title="Помилка" className="mb-4">
                {saveError}
              </Alert>
            )}
          </div>

          <Form ariaLabel="Редагування оголошення" onSubmit={handleSave}>
            {categoryLabel && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Категорія: <span className="text-gray-900 dark:text-gray-100">{categoryLabel}</span>
              </p>
            )}

            <Dropdown
              label="Тип оголошення"
              options={getListingTypeOptions(categorySlug)}
              value={listingType}
              onChange={(v) => setListingType(v as ListingType)}
            />

            <Input
              label="Назва"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={TITLE_MIN_LENGTH}
              hint={`Мінімум ${TITLE_MIN_LENGTH} символів`}
              required
            />

            <Textarea
              label="Опис"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              minLength={DESCRIPTION_MIN_LENGTH}
              hint={`Мінімум ${DESCRIPTION_MIN_LENGTH} символів`}
              rows={6}
              required
            />

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Ціна"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(sanitizeNonNegative(e.target.value))}
                  hint={PRICE_OPTIONAL_TYPES.has(listingType) ? "Необов'язково для цього типу" : undefined}
                />
              </div>
              <div className="w-24">
                <Dropdown label="Валюта" options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={isNegotiable}
                onChange={(e) => setIsNegotiable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              />
              Торг можливий
            </label>

            <SellerTypeToggle value={sellerType} onChange={setSellerType} />

            <Dropdown
              label="Область"
              options={regions.map((r) => ({ value: r.id, label: r.nameUk }))}
              value={regionId}
              onChange={(v) => {
                setRegionId(v);
                setLocationId(null);
              }}
              placeholder="Оберіть область"
              isLoading={isLoadingRegions}
              required
            />

            <Dropdown
              label="Місто"
              options={citiesInRegion.map((c) => ({ value: c.id, label: c.nameUk }))}
              value={locationId}
              onChange={setLocationId}
              placeholder={regionId ? 'Оберіть місто' : 'Спочатку оберіть область'}
              required
            />

            {getConditionOptions(categorySlug, condition).length > 0 && (
              <Dropdown
                label="Стан"
                options={getConditionOptions(categorySlug, condition)}
                value={condition}
                onChange={setCondition}
                placeholder="Не вказано"
              />
            )}

            <AttributeFields
              attributes={categoryAttributes}
              values={attributeValues}
              onChange={(id, value) => setAttributeValues((prev) => ({ ...prev, [id]: value }))}
            />

            <Button type="submit" isLoading={isSaving} disabled={!canSave}>
              Зберегти зміни
            </Button>
          </Form>
        </Card>
      )}

      {(listing.status === 'DRAFT' || listing.status === 'REJECTED') && (
        <Button isLoading={isPublishing} onClick={handlePublish}>
          Опублікувати
        </Button>
      )}
    </div>
  );
}
