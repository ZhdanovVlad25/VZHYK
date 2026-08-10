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
  type Category,
  type CategoryAttribute,
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

interface LeafCategory {
  id: string;
  label: string;
}

/** Оголошення можна створювати лише в кінцевій категорії — CATEGORY_NOT_LISTABLE на бекенді для інших. */
function flattenLeafCategories(categories: Category[], prefix = ''): LeafCategory[] {
  return categories.flatMap((c) => {
    const label = prefix ? `${prefix} → ${c.nameUk}` : c.nameUk;
    if (c.children.length === 0) {
      return [{ id: c.id, label }];
    }
    return flattenLeafCategories(c.children, label);
  });
}

export default function NewListingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, accessToken } = useAuth();

  const [leafCategories, setLeafCategories] = useState<LeafCategory[] | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({});

  const [listingType, setListingType] = useState<ListingType>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<string | null>(null);
  const [isNegotiable, setIsNegotiable] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategoryTree()
      .then((tree) => setLeafCategories(flattenLeafCategories(tree)))
      .catch(() => setLeafCategories([]));
  }, []);

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

  const categoryOptions = useMemo(
    () => (leafCategories ?? []).map((c) => ({ value: c.id, label: c.label })),
    [leafCategories],
  );

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

  if (authLoading || leafCategories === null) {
    return <LoadingState label="Завантаження…" />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Нове оголошення</h1>
      <Card>
        {error && (
          <Alert tone="danger" title="Помилка" className="mb-4">
            {error}
          </Alert>
        )}

        <Form ariaLabel="Створення оголошення" onSubmit={handleSubmit}>
          <Dropdown
            label="Категорія"
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Оберіть категорію"
          />

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
