'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  getCategoryAttributes,
  getCategoryTree,
  getListing,
  getListingMedia,
  publishListing,
  updateListing,
  uploadListingMedia,
  type Category,
  type CategoryAttribute,
  type Listing,
  type ListingType,
  type Media,
} from '@/lib/api';
import { AttributeFields, type AttributeValues } from '@/components/listings/AttributeFields';
import { Alert, Badge, Button, Card, Dropdown, ErrorState, Form, Input, LoadingState } from '@/components/ui';

const LISTING_TYPE_OPTIONS: { value: ListingType; label: string }[] = [
  { value: 'sell', label: 'Продаю' },
  { value: 'buy', label: 'Куплю' },
  { value: 'exchange', label: 'Обміняю' },
  { value: 'give_away', label: 'Віддам безкоштовно' },
  { value: 'service', label: 'Послуга' },
  { value: 'rent', label: 'Оренда' },
];

const NOT_EDITABLE_STATUSES = ['SOLD', 'ARCHIVED', 'BLOCKED'];

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Ціна не вказана';
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

function findCategoryLabel(categories: Category[], id: string, prefix = ''): string | null {
  for (const c of categories) {
    const label = prefix ? `${prefix} → ${c.nameUk}` : c.nameUk;
    if (c.id === id) return label;
    const found = findCategoryLabel(c.children, id, label);
    if (found) return found;
  }
  return null;
}

export default function EditListingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listing, setListing] = useState<Listing | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [listingType, setListingType] = useState<ListingType>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<string | null>(null);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({});

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
      setListing(listingResult);
      setMedia(mediaResult);
      setCategoryLabel(findCategoryLabel(categories, listingResult.categoryId));

      setListingType(listingResult.listingType);
      setTitle(listingResult.title);
      setDescription(listingResult.description ?? '');
      setPrice(listingResult.price === null ? '' : String(listingResult.price));
      setCondition(listingResult.condition);
      setIsNegotiable(listingResult.isNegotiable);
      setAttributeValues(Object.fromEntries(listingResult.attributes.map((a) => [a.categoryAttributeId, a.value])));

      const attrs = await getCategoryAttributes(listingResult.categoryId);
      setCategoryAttributes(attrs);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Не вдалося завантажити оголошення.');
    } finally {
      setIsLoading(false);
    }
  }, [params.id, accessToken]);

  useEffect(() => {
    if (accessToken) {
      load();
    }
  }, [accessToken, load]);

  const isEditable = useMemo(() => (listing ? !NOT_EDITABLE_STATUSES.includes(listing.status) : false), [listing]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setActionError(null);
    setIsUploading(true);
    try {
      await uploadListingMedia(params.id, file, accessToken);
      const fresh = await getListingMedia(params.id);
      setMedia(fresh);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося завантажити фото.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !listing) return;
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
          condition: (condition as 'new' | 'used' | 'for_parts') ?? undefined,
          isNegotiable,
          attributes: categoryAttributes
            .filter((attr) => attributeValues[attr.id] !== undefined && attributeValues[attr.id] !== '')
            .map((attr) => ({ categoryAttributeId: attr.id, value: attributeValues[attr.id] })),
        },
        accessToken,
      );
      setListing(updated);
      setSaveMessage('Збережено');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-700">
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <Badge tone={listing.status === 'DRAFT' ? 'neutral' : listing.status === 'ACTIVE' ? 'success' : 'warning'}>
          {listing.status}
        </Badge>
        <h1 className="text-2xl font-semibold text-gray-900">{listing.title}</h1>
      </div>
      <p className="mb-6 text-xl font-extrabold text-accent-600">{formatPrice(listing.price, listing.currency)}</p>

      {actionError && (
        <Alert tone="danger" title="Помилка" className="mb-4">
          {actionError}
        </Alert>
      )}

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Фото</h2>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL
            <img
              key={m.id}
              src={m.url}
              alt=""
              className="aspect-square w-full rounded-xl border border-gray-200 object-cover"
            />
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelected}
          disabled={isUploading}
          className="text-sm"
        />
        {isUploading && <p className="mt-1 text-sm text-gray-500">Завантаження…</p>}
      </Card>

      {!isEditable ? (
        <Alert tone="warning" title="Редагування недоступне">
          Оголошення в статусі {listing.status} більше не можна редагувати.
        </Alert>
      ) : (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Деталі оголошення</h2>

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

          <Form ariaLabel="Редагування оголошення" onSubmit={handleSave}>
            {categoryLabel && (
              <p className="text-sm text-gray-500">
                Категорія: <span className="text-gray-900">{categoryLabel}</span>
              </p>
            )}

            <Dropdown
              label="Тип оголошення"
              options={LISTING_TYPE_OPTIONS}
              value={listingType}
              onChange={(v) => setListingType(v as ListingType)}
            />

            <Input label="Назва" value={title} onChange={(e) => setTitle(e.target.value)} minLength={5} required />

            <Input
              label="Опис"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              hint="Необов'язково"
            />

            <Input
              label="Ціна, грн"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              hint={listingType === 'buy' || listingType === 'give_away' ? "Необов'язково для цього типу" : undefined}
            />

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isNegotiable}
                onChange={(e) => setIsNegotiable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Торг можливий
            </label>

            <Dropdown
              label="Стан"
              options={[
                { value: 'new', label: 'Новий' },
                { value: 'used', label: 'Вживаний' },
                { value: 'for_parts', label: 'На запчастини' },
              ]}
              value={condition}
              onChange={setCondition}
              placeholder="Не вказано"
            />

            <AttributeFields
              attributes={categoryAttributes}
              values={attributeValues}
              onChange={(id, value) => setAttributeValues((prev) => ({ ...prev, [id]: value }))}
            />

            <Button type="submit" isLoading={isSaving}>
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
