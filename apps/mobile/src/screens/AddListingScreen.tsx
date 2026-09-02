import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import {
  ApiError,
  Category,
  CategorySuggestion,
  Region,
  createListing,
  getCategoryTree,
  getRegions,
  publishListing,
  suggestCategory,
  uploadListingMedia,
  type ListingType,
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { assetToRNFile, pickPhotos } from '../lib/pickImage';
import { AutoRenewToggle } from '../components/AutoRenewToggle';
import { ChipSelect } from '../components/ChipSelect';
import { DropdownSelect } from '../components/DropdownSelect';
import { LoadingScreen } from '../components/LoadingScreen';
import {
  CONDITION_OPTIONS,
  CURRENCY_OPTIONS,
  DESCRIPTION_MIN_LENGTH,
  TITLE_MIN_LENGTH,
  getListingTypeOptions,
  isJobCategory,
  sanitizeNonNegative,
} from '../lib/listingOptions';
import type { AppNavigation } from '../navigation/types';

const PHOTO_SIZE = 88;

/** Форма нового оголошення — RN-порт apps/web/src/app/listings/new/page.tsx (без динамічних category attributes, Фаза 3 роадмапу). */
export function AddListingScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, isLoading: authLoading, accessToken } = useAuth();

  const [categoryTree, setCategoryTree] = useState<Category[] | null>(null);
  const [topCategoryId, setTopCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoadingRegions, setIsLoadingRegions] = useState(true);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [listingType, setListingType] = useState<ListingType>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('UAH');
  const [condition, setCondition] = useState<string | null>(null);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<ImagePickerAsset[]>([]);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCategoryTree().then(setCategoryTree).catch(() => setCategoryTree([]));
    getRegions()
      .then(setRegions)
      .catch(() => setRegions([]))
      .finally(() => setIsLoadingRegions(false));
  }, []);

  // Дебаунс: підказка категорії за назвою (backend `/categories/suggest`) — той самий
  // патерн, що apps/web/src/app/listings/new/page.tsx.
  useEffect(() => {
    setSuggestionDismissed(false);
    if (title.trim().length < 3) {
      setSuggestion(null);
      return;
    }
    const handle = setTimeout(() => {
      suggestCategory(title).then(setSuggestion).catch(() => setSuggestion(null));
    }, 500);
    return () => clearTimeout(handle);
  }, [title]);

  const topCategories = categoryTree ?? [];
  const selectedTop = useMemo(() => topCategories.find((c) => c.id === topCategoryId) ?? null, [topCategories, topCategoryId]);
  const subCategories = selectedTop?.children ?? [];
  const categoryId = subCategories.length > 0 ? subCategoryId : topCategoryId;
  const categorySlug =
    (subCategories.length > 0 ? subCategories : topCategories).find((c) => c.id === categoryId)?.slug ?? null;
  const listingTypeOptions = getListingTypeOptions(categorySlug);
  const conditionAvailable = !isJobCategory(categorySlug);

  // "Робота" пропонує інший набір типів (вакансія/резюме) — перемикання категорії туди-назад
  // мусить скидати вибір і "Стан", інакше лишається невалідне значення з попереднього набору.
  useEffect(() => {
    if (!listingTypeOptions.some((o) => o.value === listingType)) {
      setListingType(listingTypeOptions[0]?.value ?? 'sell');
    }
    if (!conditionAvailable && condition !== null) {
      setCondition(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- лише на зміну доступних варіантів категорії
  }, [categorySlug]);

  const selectedRegion = useMemo(() => regions.find((r) => r.id === regionId) ?? null, [regions, regionId]);
  const citiesInRegion = selectedRegion?.cities ?? [];

  const isTitleValid = title.trim().length >= TITLE_MIN_LENGTH;
  const isDescriptionValid = description.trim().length >= DESCRIPTION_MIN_LENGTH;
  const canSubmit = Boolean(categoryId) && isTitleValid && isDescriptionValid && Boolean(locationId);

  const showSuggestion =
    !suggestionDismissed &&
    suggestion !== null &&
    (suggestion.topCategoryId !== topCategoryId || suggestion.subCategoryId !== subCategoryId);

  function applySuggestion() {
    if (!suggestion) return;
    setTopCategoryId(suggestion.topCategoryId);
    setSubCategoryId(suggestion.subCategoryId);
  }

  async function handleAddPhoto() {
    setError(null);
    setIsPickingPhoto(true);
    try {
      const assets = await pickPhotos();
      if (assets.length > 0) setPendingPhotos((prev) => [...prev, ...assets]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося вибрати фото.');
    } finally {
      setIsPickingPhoto(false);
    }
  }

  function removePendingPhoto(uri: string) {
    setPendingPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function handleSubmit(publishNow: boolean) {
    if (!accessToken || !canSubmit || !categoryId) return;
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
          autoRenew,
        },
        accessToken,
      );
      let failedPhotoCount = 0;
      for (const asset of pendingPhotos) {
        await uploadListingMedia(listing.id, assetToRNFile(asset), accessToken).catch(() => {
          failedPhotoCount += 1;
        });
      }

      let publishError: string | null = null;
      if (publishNow) {
        try {
          await publishListing(listing.id, accessToken);
        } catch (err) {
          // Оголошення вже створено (і фото завантажені) — не втрачаємо цей результат через
          // помилку публікації, лише повідомляємо; дозавершити публікацію можна на екрані редагування.
          publishError =
            err instanceof ApiError ? err.message : 'Оголошення створено, але не вдалося опублікувати.';
        }
      }

      setTitle('');
      setDescription('');
      setPrice('');
      setTopCategoryId(null);
      setSubCategoryId(null);
      setRegionId(null);
      setLocationId(null);
      setCondition(null);
      setIsNegotiable(false);
      setAutoRenew(false);
      setPendingPhotos([]);
      // Alert, не setError — екран переходить на EditListing одразу, банер помилки тут ніхто б не побачив.
      if (failedPhotoCount > 0) {
        Alert.alert(
          'Не всі фото завантажились',
          failedPhotoCount === pendingPhotos.length
            ? 'Оголошення створено, але жодне фото не вдалося завантажити. Спробуйте додати їх ще раз на екрані редагування.'
            : `Оголошення створено, але ${failedPhotoCount} з ${pendingPhotos.length} фото не вдалося завантажити. Спробуйте додати їх ще раз на екрані редагування.`,
        );
      }
      if (publishError) Alert.alert('Не вдалося опублікувати', publishError);
      navigation.navigate('EditListing', { listingId: listing.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося створити оголошення. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
      setIsPublishing(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Щоб додати оголошення, потрібно увійти.</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.primaryButtonText}>Увійти</Text>
        </Pressable>
      </View>
    );
  }

  if (authLoading || categoryTree === null) {
    return (
      <View style={styles.center}>
        <LoadingScreen />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Нове оголошення</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Назва</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Наприклад, iPhone 13" placeholderTextColor={colors.textMuted} style={styles.input} />
          <Text style={styles.hint}>Мінімум {TITLE_MIN_LENGTH} символів</Text>
        </View>

        {showSuggestion && suggestion && (
          <View style={styles.suggestionBox}>
            <Text style={styles.suggestionText}>
              Схоже, це{' '}
              <Text style={styles.suggestionCategory}>{suggestion.subCategoryName ?? suggestion.topCategoryName}</Text>
              {suggestion.subCategoryName && <Text style={styles.suggestionParent}> ({suggestion.topCategoryName})</Text>}. Підтвердити
              категорію?
            </Text>
            <View style={styles.suggestionActions}>
              <Pressable style={styles.suggestionButton} onPress={applySuggestion}>
                <Text style={styles.suggestionButtonText}>Так</Text>
              </Pressable>
              <Pressable style={styles.suggestionButtonGhost} onPress={() => setSuggestionDismissed(true)}>
                <Text style={styles.suggestionButtonGhostText}>Ні</Text>
              </Pressable>
            </View>
          </View>
        )}

        <ChipSelect
          label="Категорія"
          options={topCategories.map((c) => ({ value: c.id, label: c.nameUk }))}
          value={topCategoryId}
          onChange={(v) => {
            setTopCategoryId(v);
            setSubCategoryId(null);
          }}
        />

        {subCategories.length > 0 && (
          <ChipSelect
            label="Підкатегорія"
            options={subCategories.map((c) => ({ value: c.id, label: c.nameUk }))}
            value={subCategoryId}
            onChange={setSubCategoryId}
          />
        )}

        <ChipSelect
          label="Тип оголошення"
          options={listingTypeOptions}
          value={listingType}
          onChange={(v) => setListingType(v as ListingType)}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Опис</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Стан, комплектація, деталі..."
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            style={[styles.input, styles.textArea]}
          />
          <Text style={styles.hint}>Мінімум {DESCRIPTION_MIN_LENGTH} символів</Text>
        </View>

        <View style={styles.priceRow}>
          <View style={[styles.field, styles.priceField]}>
            <Text style={styles.label}>Ціна</Text>
            <TextInput
              value={price}
              onChangeText={(v) => setPrice(sanitizeNonNegative(v))}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.currencyField}>
            <ChipSelect label="Валюта" options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Фото</Text>
          {pendingPhotos.length > 0 && (
            <View style={styles.photoGrid}>
              {pendingPhotos.map((asset) => (
                <View key={asset.uri} style={styles.photoWrap}>
                  <Image source={{ uri: asset.uri }} style={styles.photo} />
                  <Pressable style={styles.photoRemove} onPress={() => removePendingPhoto(asset.uri)}>
                    <Text style={styles.photoRemoveText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Pressable style={styles.secondaryButton} onPress={handleAddPhoto} disabled={isPickingPhoto}>
            {isPickingPhoto ? <ActivityIndicator color={colors.accent[700]} /> : <Text style={styles.secondaryButtonText}>Додати фото</Text>}
          </Pressable>
          <Text style={styles.hint}>Фото завантажаться одразу після створення оголошення</Text>
        </View>

        <DropdownSelect
          label="Область"
          options={regions.map((r) => ({ value: r.id, label: r.nameUk }))}
          value={regionId}
          onChange={(v) => {
            setRegionId(v);
            setLocationId(null);
          }}
          isLoading={isLoadingRegions}
        />

        <DropdownSelect
          label="Місто"
          options={citiesInRegion.map((c) => ({ value: c.id, label: c.nameUk }))}
          value={locationId}
          onChange={setLocationId}
          emptyHint={regionId ? 'У цій області немає міст' : 'Спочатку оберіть область'}
        />

        {conditionAvailable && (
          <ChipSelect label="Стан" options={CONDITION_OPTIONS} value={condition} onChange={setCondition} />
        )}

        <View style={styles.switchRow}>
          <Text style={styles.label}>Торг можливий</Text>
          <Switch value={isNegotiable} onValueChange={setIsNegotiable} trackColor={{ true: colors.brand[500] }} />
        </View>

        <AutoRenewToggle checked={autoRenew} onChange={setAutoRenew} />

        <View style={styles.submitRow}>
          <Pressable
            style={[styles.primaryButton, styles.submitButton, !canSubmit && styles.primaryButtonDisabled]}
            onPress={() => handleSubmit(true)}
            disabled={!canSubmit || isSubmitting || isPublishing}
          >
            {isPublishing ? <ActivityIndicator color={colors.buttonText} /> : <Text style={styles.primaryButtonText}>Опублікувати</Text>}
          </Pressable>
          <Pressable
            style={[styles.draftButton, styles.submitButton, !canSubmit && styles.primaryButtonDisabled]}
            onPress={() => handleSubmit(false)}
            disabled={!canSubmit || isSubmitting || isPublishing}
          >
            {isSubmitting ? <ActivityIndicator color={colors.accent[700]} /> : <Text style={styles.draftButtonText}>Зберегти як чернетку</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerText: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: colors.text },
  hint: { fontSize: 12, color: colors.textMuted },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  priceField: { flex: 1 },
  currencyField: { flexShrink: 0 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryButton: { backgroundColor: colors.accent[600], borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, alignItems: 'center' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 15 },
  submitRow: { gap: 10 },
  submitButton: { width: '100%' },
  draftButton: {
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  draftButtonText: { color: colors.accent[700], fontWeight: '600', fontSize: 15 },
  errorBox: {
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: colors.accent[600], fontSize: 13 },
  suggestionBox: {
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  // suggestionBox завжди на світлій brand[50] поверхні незалежно від теми — теж бренд-відтінки,
  // інакше colors.text/textMuted (світлі в темній темі) зливаються з фоном.
  suggestionText: { color: colors.brand[900], fontSize: 13, lineHeight: 18 },
  suggestionCategory: { fontWeight: '700', color: colors.brand[900] },
  suggestionParent: { color: colors.brand[700] },
  suggestionActions: { flexDirection: 'row', gap: 8 },
  suggestionButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  suggestionButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 13 },
  suggestionButtonGhost: { borderWidth: 1, borderColor: colors.brand[200], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  suggestionButtonGhostText: { color: colors.brand[700], fontWeight: '600', fontSize: 13 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 12, backgroundColor: colors.border },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 16 },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: colors.accent[700], fontWeight: '600', fontSize: 13 },
  });
}
