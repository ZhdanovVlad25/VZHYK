'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  getCategoryTree,
  listingDetailHref,
  searchAdminListings,
  updateAdminListing,
  type Category,
  type Listing,
  type ListingStatus,
} from '@/lib/api';
import {
  Badge,
  Button,
  Dropdown,
  EmptyState,
  ErrorState,
  Form,
  Input,
  LoadingState,
  Modal,
  type BadgeTone,
} from '@/components/ui';
import { formatPrice } from '@/lib/format';

const STATUS_LABELS: Record<ListingStatus, string> = {
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

const STATUS_TONES: Record<ListingStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_MODERATION: 'warning',
  ACTIVE: 'success',
  REJECTED: 'danger',
  RESERVED: 'info',
  SOLD: 'neutral',
  EXPIRED: 'neutral',
  ARCHIVED: 'neutral',
  BLOCKED: 'danger',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Усі статуси' },
  ...(Object.keys(STATUS_LABELS) as ListingStatus[]).map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

const CURRENCY_OPTIONS = [
  { value: 'UAH', label: 'UAH' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

/** Той самий "topCategory + його безпосередня дитина" контракт, що listings/new — категорія
 * оголошення завжди або сама top-рівнева (без дітей), або одна з children топ-категорії. */
function findCategoryPath(categories: Category[], id: string): { topId: string; subId: string | null } | null {
  for (const top of categories) {
    if (top.id === id) return { topId: top.id, subId: null };
    if (top.children.some((c) => c.id === id)) return { topId: top.id, subId: id };
  }
  return null;
}

interface EditFormState {
  title: string;
  description: string;
  price: string;
  currency: string;
  topCategoryId: string | null;
  subCategoryId: string | null;
}

export default function AdminListingsPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    title: '',
    description: '',
    price: '',
    currency: 'UAH',
    topCategoryId: null,
    subCategoryId: null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    getCategoryTree().then(setCategoryTree).catch(() => setCategoryTree([]));
  }, []);

  const editTopCategory = categoryTree.find((c) => c.id === editForm.topCategoryId) ?? null;
  const editSubCategories = editTopCategory?.children ?? [];

  const load = useCallback(
    async (searchOverride?: string) => {
      if (!accessToken) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await searchAdminListings(
          accessToken,
          searchOverride ?? undefined,
          status === 'ALL' ? undefined : (status as ListingStatus),
        );
        setListings(result);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити оголошення.');
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, status],
  );

  useEffect(() => {
    if (accessToken && isAdmin) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isAdmin, status]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    load(search || undefined);
  }

  async function handleToggleBlock(listing: Listing) {
    if (!accessToken) return;
    setActingId(listing.id);
    try {
      const updated = await updateAdminListing(
        listing.id,
        { status: listing.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED' },
        accessToken,
      );
      setListings((prev) => prev.map((l) => (l.id === listing.id ? { ...l, ...updated } : l)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося змінити статус оголошення.');
    } finally {
      setActingId(null);
    }
  }

  function openEdit(listing: Listing) {
    const path = findCategoryPath(categoryTree, listing.categoryId);
    setEditing(listing);
    setEditForm({
      title: listing.title,
      description: listing.description ?? '',
      price: listing.price !== null ? String(listing.price) : '',
      currency: listing.currency,
      topCategoryId: path?.topId ?? null,
      subCategoryId: path?.subId ?? null,
    });
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!accessToken || !editing) return;
    const categoryId = editSubCategories.length > 0 ? editForm.subCategoryId : editForm.topCategoryId;
    setIsSaving(true);
    try {
      const updated = await updateAdminListing(
        editing.id,
        {
          title: editForm.title,
          description: editForm.description,
          price: editForm.price ? Number(editForm.price) : undefined,
          currency: editForm.currency,
          categoryId: categoryId ?? undefined,
        },
        accessToken,
      );
      setListings((prev) => prev.map((l) => (l.id === editing.id ? { ...l, ...updated } : l)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700 dark:text-gray-300">Щоб керувати оголошеннями, потрібно увійти.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  if (!authLoading && user && !isAdmin) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-700 dark:text-gray-300">Доступ лише для адміністраторів.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Оголошення (адмін)</h1>
        <div className="w-56">
          <Dropdown label="Статус" options={STATUS_FILTER_OPTIONS} value={status} onChange={setStatus} />
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-6 flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <Input label="Пошук за назвою" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">
          Знайти
        </Button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження оголошень…" />
      ) : listings.length === 0 ? (
        <EmptyState title="Оголошень не знайдено" description="Спробуйте змінити фільтри пошуку." />
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => (
            <li key={listing.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONES[listing.status]}>{STATUS_LABELS[listing.status]}</Badge>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Створено {formatDate(listing.createdAt)}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">Власник: {listing.userId.slice(0, 8)}</span>
                  </div>
                  <Link href={listingDetailHref(listing)} className="font-medium text-gray-900 hover:underline dark:text-gray-100">
                    {listing.title}
                  </Link>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatPrice(listing.price, listing.currency)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(listing)}>
                    Редагувати
                  </Button>
                  <Button
                    size="sm"
                    variant={listing.status === 'BLOCKED' ? 'secondary' : 'danger'}
                    isLoading={actingId === listing.id}
                    onClick={() => handleToggleBlock(listing)}
                  >
                    {listing.status === 'BLOCKED' ? 'Розблокувати' : 'Заблокувати'}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title="Редагувати оголошення">
        <Form onSubmit={handleSaveEdit}>
          <Input
            label="Назва"
            value={editForm.title}
            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-listing-description" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Опис
            </label>
            <textarea
              id="admin-listing-description"
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:border-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <Input
            label="Ціна"
            type="number"
            min={0}
            value={editForm.price}
            onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
          />
          <Dropdown
            label="Валюта"
            options={CURRENCY_OPTIONS}
            value={editForm.currency}
            onChange={(value) => setEditForm((f) => ({ ...f, currency: value }))}
          />
          <Dropdown
            label="Категорія"
            options={categoryTree.map((c) => ({ value: c.id, label: c.nameUk }))}
            value={editForm.topCategoryId}
            onChange={(value) => setEditForm((f) => ({ ...f, topCategoryId: value, subCategoryId: null }))}
          />
          {editSubCategories.length > 0 && (
            <Dropdown
              label="Підкатегорія"
              options={editSubCategories.map((c) => ({ value: c.id, label: c.nameUk }))}
              value={editForm.subCategoryId}
              onChange={(value) => setEditForm((f) => ({ ...f, subCategoryId: value }))}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              Скасувати
            </Button>
            <Button type="submit" isLoading={isSaving}>
              Зберегти
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
