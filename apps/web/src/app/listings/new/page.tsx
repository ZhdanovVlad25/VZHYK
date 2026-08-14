'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  createListing,
  getCategoryAttributes,
  getCategoryTree,
  getCities,
  suggestCategory,
  type Category,
  type CategoryAttribute,
  type CategorySuggestion,
  type City,
  type ListingType,
} from '@/lib/api';
import { AttributeFields, type AttributeValues } from '@/components/listings/AttributeFields';
import { Alert, Button, Card, Dropdown, Form, Input, LoadingState } from '@/components/ui';

const LISTING_TYPE_OPTIONS: { value: ListingType; label: string }[] = [
  { value: 'sell', label: 'Продаю' },
  { value: 'buy', label: 'Куплю' },
  { value: 'exchange', label: 'Обміняю' },
  { value: 'give_away', label: 'Віддам безкоштовно' },
  { value: 'service', label: 'Послуга' },
  { value: 'rent', label: 'Оренда' },
];

export default function NewListingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, accessToken } = useAuth();

  const [categoryTree, setCategoryTree] = useState<Category[] | null>(null);
  const [topCategoryId, setTopCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({});
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const [listingType, setListingType] = useState<ListingType>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<string | null>(null);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategoryTree()
      .then(setCategoryTree)
      .catch(() => setCategoryTree([]));
    getCities().then(setCities).catch(() => setCities([]));
  }, []);

  const topCategories = categoryTree ?? [];
  const selectedTop = useMemo(
    () => (categoryTree ?? []).find((c) => c.id === topCategoryId) ?? null,
    [categoryTree, topCategoryId],
  );
  // Дитячий світ — поки єдина категорія з підкатегоріями (max depth 1, docs/categories.md);
  // якщо в неї немає дітей, вона сама вже кінцева й нічого обирати далі не треба.
  const subCategories = selectedTop?.children ?? [];
  const categoryId = subCategories.length > 0 ? subCategoryId : topCategoryId;

  // Дебаунс: підказка категорії за назвою (backend `/categories/suggest`, ключові слова).
  // Скидаємо "відхилено" і саму підказку щоразу, коли назва міняється — стара підказка
  // для іншого тексту не має сенсу.
  useEffect(() => {
    setSuggestionDismissed(false);
    if (title.trim().length < 3) {
      setSuggestion(null);
      return;
    }
    const handle = setTimeout(() => {
      suggestCategory(title)
        .then(setSuggestion)
        .catch(() => setSuggestion(null));
    }, 500);
    return () => clearTimeout(handle);
  }, [title]);

  const showSuggestion =
    !suggestionDismissed &&
    suggestion !== null &&
    (suggestion.topCategoryId !== topCategoryId || suggestion.subCategoryId !== subCategoryId);

  function applySuggestion() {
    if (!suggestion) return;
    setTopCategoryId(suggestion.topCategoryId);
    setSubCategoryId(suggestion.subCategoryId);
  }

  useEffect(() => {
    if (!categoryId) {
      setCategoryAttributes([]);
      return;
    }
    setAttributeValues({});
    getCategoryAttributes(categoryId)
      .then(setCategoryAttributes)
      .catch(() => setCategoryAttributes([]));
  }, [categoryId]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700">Щоб додати оголошення, потрібно увійти.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !categoryId) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const listing = await createListing(
        {
          categoryId,
          listingType,
          title,
          description: description || undefined,
          price: price === '' ? undefined : Number(price),
          condition: (condition as 'new' | 'used' | 'for_parts') ?? undefined,
          locationId: locationId ?? undefined,
          isNegotiable,
          attributes: categoryAttributes
            .filter((attr) => attributeValues[attr.id] !== undefined && attributeValues[attr.id] !== '')
            .map((attr) => ({ categoryAttributeId: attr.id, value: attributeValues[attr.id] })),
        },
        accessToken,
      );
      router.push(`/listings/${listing.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося створити оголошення. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (authLoading || categoryTree === null) {
    return <LoadingState label="Завантаження…" />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Нове оголошення</h1>
      <Card>
        {error && (
          <Alert tone="danger" title="Помилка" className="mb-4">
            {error}
          </Alert>
        )}

        <Form ariaLabel="Створення оголошення" onSubmit={handleSubmit}>
          {showSuggestion && suggestion && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-3 text-sm">
              <p className="flex-1 text-gray-700">
                Схоже, це{' '}
                <span className="font-medium text-gray-900">
                  {suggestion.subCategoryName ?? suggestion.topCategoryName}
                </span>
                {suggestion.subCategoryName && (
                  <span className="text-gray-500"> ({suggestion.topCategoryName})</span>
                )}
                . Підтвердити категорію?
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={applySuggestion}>
                  Так
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSuggestionDismissed(true)}>
                  Ні
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            <Dropdown
              label="Категорія"
              options={topCategories.map((c) => ({ value: c.id, label: c.nameUk }))}
              value={topCategoryId}
              onChange={(v) => {
                setTopCategoryId(v);
                setSubCategoryId(null);
              }}
              placeholder="Оберіть категорію"
            />

            {subCategories.length > 0 && (
              <Dropdown
                label="Підкатегорія"
                options={subCategories.map((c) => ({ value: c.id, label: c.nameUk }))}
                value={subCategoryId}
                onChange={setSubCategoryId}
                placeholder="Оберіть підкатегорію"
              />
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
              hint={listingType === 'buy' || listingType === 'give_away' ? 'Необов\'язково для цього типу' : undefined}
            />

            <Dropdown
              label="Місто"
              options={cities.map((c) => ({ value: c.id, label: c.nameUk }))}
              value={locationId}
              onChange={setLocationId}
              placeholder="Не вказано"
            />

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
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isNegotiable}
              onChange={(e) => setIsNegotiable(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Торг можливий
          </label>

          {categoryId && (
            <AttributeFields
              attributes={categoryAttributes}
              values={attributeValues}
              onChange={(id, value) => setAttributeValues((prev) => ({ ...prev, [id]: value }))}
            />
          )}

          <Button type="submit" isLoading={isSubmitting} disabled={!categoryId}>
            Створити чернетку
          </Button>
        </Form>
      </Card>
    </div>
  );
}
