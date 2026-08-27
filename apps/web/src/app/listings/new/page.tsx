'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  createListing,
  getCategoryAttributes,
  getCategoryTree,
  getRegions,
  publishListing,
  suggestCategory,
  uploadListingMedia,
  type Category,
  type CategoryAttribute,
  type CategorySuggestion,
  type ListingType,
  type Region,
} from '@/lib/api';
import { AttributeFields, type AttributeValues } from '@/components/listings/AttributeFields';
import { Alert, Button, Card, Dropdown, Form, Input, LoadingState, Textarea } from '@/components/ui';
import { getConditionOptions } from '@/lib/listing-condition';

const LISTING_TYPE_OPTIONS: { value: ListingType; label: string }[] = [
  { value: 'sell', label: 'Продаю' },
  { value: 'buy', label: 'Куплю' },
  { value: 'exchange', label: 'Обміняю' },
  { value: 'give_away', label: 'Віддам безкоштовно' },
  { value: 'service', label: 'Послуга' },
  { value: 'rent', label: 'Оренда' },
];

const CURRENCY_OPTIONS = [
  { value: 'UAH', label: 'грн' },
  { value: 'USD', label: '$' },
  { value: 'EUR', label: '€' },
];

/** Ціна не може бути відʼємною — прибираємо будь-який "-" одразу при вводі, а не лише min на спінері (той не блокує ручний ввід "-6"). */
function sanitizeNonNegative(raw: string): string {
  return raw.replace(/-/g, '');
}

const TITLE_MIN_LENGTH = 5;
// Достатньо, щоб відсіяти порожні "асд"-заглушки, але не заважати короткому опису одним реченням.
const DESCRIPTION_MIN_LENGTH = 10;

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
  const [currency, setCurrency] = useState('UAH');
  const [condition, setCondition] = useState<string | null>(null);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  // createObjectURL створюється ОДИН РАЗ на файл (не на кожен рендер — інакше кожне
  // натискання клавіші будь-де у формі створювало б нові URL на всі фото одразу, не
  // звільняючи старі; для кількох реальних фото з телефону (по кілька МБ кожне) це
  // швидко з'їдало пам'ять і на iOS Safari могло вбивати вкладку під час набору тексту).
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Раніше "Опублікувати" на порожній Категорії/Області/Місті просто нічого не робила
  // (disabled-кнопка без пояснення) — аудит 27.08 знайшов це як критичну знахідку.
  // Тепер кнопка завжди клікабельна, а перша спроба сабміту вмикає видимі помилки
  // під конкретними полями замість мовчазного ігнорування кліку.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

  // Клієнтський компонент не може експортувати metadata (App Router) — /listings/new і так
  // поза індексацією (robots.txt), це суто для вкладки браузера (аудит 27.08: <title> лишався
  // загальним "Вжик — оголошення" на формі створення).
  useEffect(() => {
    document.title = 'Нове оголошення — Вжик';
    return () => {
      document.title = 'Вжик — оголошення';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCategoryTree()
      .then((tree) => !cancelled && setCategoryTree(tree))
      .catch(() => !cancelled && setCategoryTree([]));
    getRegions()
      .then((r) => !cancelled && setRegions(r))
      .catch(() => !cancelled && setRegions([]))
      .finally(() => !cancelled && setIsLoadingRegions(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const urls = pendingPhotos.map((file) => URL.createObjectURL(file));
    setPhotoPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingPhotos]);

  const selectedRegion = useMemo(
    () => regions.find((r) => r.id === regionId) ?? null,
    [regions, regionId],
  );
  const citiesInRegion = selectedRegion?.cities ?? [];

  const topCategories = categoryTree ?? [];
  const selectedTop = useMemo(
    () => (categoryTree ?? []).find((c) => c.id === topCategoryId) ?? null,
    [categoryTree, topCategoryId],
  );
  // Дерево категорій має макс. глибину 1 (docs/categories.md) — якщо в обраної топ-категорії
  // немає дітей, вона сама вже кінцева й нічого обирати далі не треба.
  const subCategories = selectedTop?.children ?? [];
  const categoryId = subCategories.length > 0 ? subCategoryId : topCategoryId;
  // Для варіантів "Стан" потрібен slug кінцевої (обраної) категорії, не topCategoryId —
  // "На запчастини" виключається/лишається залежно від конкретної підкатегорії (напр. шини).
  const categorySlug =
    (subCategories.length > 0 ? subCategories : topCategories).find((c) => c.id === categoryId)?.slug ?? null;

  // Дебаунс: підказка категорії за назвою (backend `/categories/suggest`, ключові слова).
  // Скидаємо "відхилено" і саму підказку щоразу, коли назва міняється — стара підказка
  // для іншого тексту не має сенсу.
  useEffect(() => {
    let cancelled = false;
    setSuggestionDismissed(false);
    if (title.trim().length < 3) {
      setSuggestion(null);
      return;
    }
    const handle = setTimeout(() => {
      suggestCategory(title)
        .then((s) => !cancelled && setSuggestion(s))
        .catch(() => !cancelled && setSuggestion(null));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
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
        <p className="mb-4 text-gray-700 dark:text-gray-300">Щоб додати оголошення, потрібно увійти.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  const isTitleValid = title.trim().length >= TITLE_MIN_LENGTH;
  const isDescriptionValid = description.trim().length >= DESCRIPTION_MIN_LENGTH;
  const canSubmit = Boolean(categoryId) && isTitleValid && isDescriptionValid && Boolean(locationId);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) setPendingPhotos((prev) => [...prev, ...Array.from(files)]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(publishNow: boolean) {
    if (!accessToken) return;
    setAttemptedSubmit(true);
    if (!canSubmit || !categoryId) {
      setError('Заповніть усі обов’язкові поля, позначені зірочкою.');
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setError(null);
    if (publishNow) setIsPublishing(true);
    else setIsSubmitting(true);
    try {
      const listing = await createListing(
        {
          categoryId,
          listingType,
          title,
          description: description || undefined,
          price: price === '' ? undefined : Number(price),
          currency,
          condition: (condition as 'new' | 'used' | 'for_parts') ?? undefined,
          locationId: locationId ?? undefined,
          isNegotiable,
          attributes: categoryAttributes
            .filter((attr) => attributeValues[attr.id] !== undefined && attributeValues[attr.id] !== '')
            .map((attr) => ({ categoryAttributeId: attr.id, value: attributeValues[attr.id] })),
        },
        accessToken,
      );
      let failedPhotoCount = 0;
      for (const file of pendingPhotos) {
        await uploadListingMedia(listing.id, file, accessToken).catch(() => {
          failedPhotoCount += 1;
        });
      }

      // Якщо ВСІ фото не завантажились — не публікуємо мовчки без жодного фото (аудит 27.08:
      // "якщо вивантаження впаде, оголошення вже опубліковане без фото"). Чернетка лишається
      // збереженою, юзер повертається на редагування, де може додати фото ще раз і опублікувати сам.
      const allPhotosFailed = pendingPhotos.length > 0 && failedPhotoCount === pendingPhotos.length;

      let publishError: string | null = null;
      if (publishNow && !allPhotosFailed) {
        try {
          await publishListing(listing.id, accessToken);
        } catch (err) {
          // Оголошення вже створено (і фото завантажені) — не втрачаємо цей результат через
          // помилку публікації, лише переносимо повідомлення на екран редагування, звідки
          // публікацію можна повторити.
          publishError =
            err instanceof ApiError ? err.message : 'Оголошення створено, але не вдалося опублікувати.';
        }
      }

      // window.alert, не setError — сторінка одразу переходить на редагування, банер тут ніхто б не побачив.
      // Фото, що не завантажились, раніше мовчки губились — тепер явно попереджаємо, бо
      // "опубліковано без фото" виглядає як робочий результат, доки не глянеш на оголошення.
      if (failedPhotoCount > 0) {
        window.alert(
          allPhotosFailed
            ? 'Жодне фото не вдалося завантажити, тож оголошення збережено як чернетку (не опубліковано). Додайте фото ще раз на сторінці редагування і опублікуйте.'
            : `Оголошення створено, але ${failedPhotoCount} з ${pendingPhotos.length} фото не вдалося завантажити. Спробуйте додати їх ще раз на сторінці редагування.`,
        );
      }
      if (publishError) window.alert(publishError);
      router.push(`/listings/${listing.id}/edit`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося створити оголошення. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
      setIsPublishing(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit(true);
  }

  if (authLoading || categoryTree === null) {
    return <LoadingState label="Завантаження…" />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8" ref={formTopRef}>
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">Нове оголошення</h1>
      <Card>
        {error && (
          <Alert tone="danger" title="Помилка" className="mb-4">
            {error}
          </Alert>
        )}

        <Form ariaLabel="Створення оголошення" onSubmit={handleSubmit}>
          {showSuggestion && suggestion && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="flex-1 text-gray-700 dark:text-gray-300">
                Схоже, це{' '}
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {suggestion.subCategoryName ?? suggestion.topCategoryName}
                </span>
                {suggestion.subCategoryName && (
                  <span className="text-gray-500 dark:text-gray-400"> ({suggestion.topCategoryName})</span>
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
            <Input
              label="Назва"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={TITLE_MIN_LENGTH}
              hint={`Мінімум ${TITLE_MIN_LENGTH} символів`}
              error={attemptedSubmit && !isTitleValid ? `Мінімум ${TITLE_MIN_LENGTH} символів` : undefined}
              required
            />

            <Dropdown
              label="Категорія"
              options={topCategories.map((c) => ({ value: c.id, label: c.nameUk }))}
              value={topCategoryId}
              onChange={(v) => {
                setTopCategoryId(v);
                setSubCategoryId(null);
              }}
              placeholder="Оберіть категорію"
              isLoading={categoryTree === null}
              error={attemptedSubmit && !topCategoryId ? 'Оберіть категорію' : undefined}
              required
            />

            {subCategories.length > 0 && (
              <Dropdown
                label="Підкатегорія"
                options={subCategories.map((c) => ({ value: c.id, label: c.nameUk }))}
                value={subCategoryId}
                onChange={setSubCategoryId}
                placeholder="Оберіть підкатегорію"
                error={attemptedSubmit && !subCategoryId ? 'Оберіть підкатегорію' : undefined}
                required
              />
            )}

            <Dropdown
              label="Тип оголошення"
              options={LISTING_TYPE_OPTIONS}
              value={listingType}
              onChange={(v) => setListingType(v as ListingType)}
            />

            {/* col-span-2 — textarea без цього ділить рядок сітки з коротким полем поруч
                (напр. "Тип оголошення"): CSS Grid вирівнює висоту рядка по найвищому елементу,
                тож коротке поле лишало під собою величезний порожній простір під висоту textarea. */}
            <div className="md:col-span-2">
              <Textarea
                label="Опис"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minLength={DESCRIPTION_MIN_LENGTH}
                hint={`Мінімум ${DESCRIPTION_MIN_LENGTH} символів`}
                error={attemptedSubmit && !isDescriptionValid ? `Мінімум ${DESCRIPTION_MIN_LENGTH} символів` : undefined}
                rows={6}
                required
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Ціна"
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(sanitizeNonNegative(e.target.value))}
                  hint={listingType === 'buy' || listingType === 'give_away' ? 'Необов\'язково для цього типу' : undefined}
                />
              </div>
              <div className="w-24">
                <Dropdown label="Валюта" options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
              </div>
            </div>

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
              error={attemptedSubmit && !regionId ? 'Оберіть область' : undefined}
              required
            />

            <Dropdown
              label="Місто"
              options={citiesInRegion.map((c) => ({ value: c.id, label: c.nameUk }))}
              value={locationId}
              onChange={setLocationId}
              placeholder={regionId ? 'Оберіть місто' : 'Спочатку оберіть область'}
              error={attemptedSubmit && !locationId ? 'Оберіть місто' : undefined}
              required
            />

            <Dropdown
              label="Стан"
              options={getConditionOptions(categorySlug, condition)}
              value={condition}
              onChange={setCondition}
              placeholder="Не вказано"
            />
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Фото</h2>
            {pendingPhotos.length > 0 && (
              <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {pendingPhotos.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="group relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element -- локальний File-прев'ю, не потребує next/image */}
                    <img
                      src={photoPreviewUrls[index]}
                      alt=""
                      className="h-full w-full rounded-xl border border-gray-200 object-cover dark:border-gray-700"
                    />
                    <button
                      type="button"
                      onClick={() => removePendingPhoto(index)}
                      aria-label="Прибрати фото"
                      // 44px — мінімальна рекомендована зона дотику для пальця (аудит 27.08).
                      // Видимий гурток лишається h-5/w-5 (зростання перекривало б сусідні
                      // мініатюри у щільній сітці grid-cols-4/6) — зона дотику розширена
                      // невидимим ::before до 44×44 навколо того самого центру.
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent-600 text-xs font-bold leading-none text-white before:absolute before:left-1/2 before:top-1/2 before:h-11 before:w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Нативна кнопка file-інпуту показує текст мовою браузера — ховаємо сам input
                і керуємо вибором файлу через стилізовану кнопку сторінки (той самий патерн,
                що в apps/web/src/app/listings/[id]/edit/page.tsx). */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleFileSelected}
              className="sr-only"
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
              Додати фото
            </Button>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Фото завантажаться одразу після створення оголошення</p>
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

          {categoryId && (
            <AttributeFields
              attributes={categoryAttributes}
              values={attributeValues}
              onChange={(id, value) => setAttributeValues((prev) => ({ ...prev, [id]: value }))}
            />
          )}

          <div className="flex flex-wrap gap-2">
            {/* Кнопки НЕ disabled на невалідній формі (аудит 27.08: раніше клік по disabled
                кнопці нічого не робив і не пояснював чому) — клік завжди запускає submit(),
                а той сам вирішує: показати помилки під полями чи продовжити. isLoading і
                далі блокує повторний клік під час реального запиту. */}
            <Button type="submit" isLoading={isPublishing}>
              Опублікувати
            </Button>
            <Button
              type="button"
              variant="secondary"
              isLoading={isSubmitting}
              onClick={() => submit(false)}
            >
              Зберегти як чернетку
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}
