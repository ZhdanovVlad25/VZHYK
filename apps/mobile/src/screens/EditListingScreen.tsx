import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ApiError,
  Category,
  City,
  Listing,
  Media,
  Region,
  getCategoryTree,
  getCities,
  getListing,
  getListingMedia,
  getRegions,
  publishListing,
  updateListing,
  uploadListingMedia,
  type ListingType,
} from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { formatPrice } from '../lib/format';
import { assetToRNFile, pickPhotos } from '../lib/pickImage';
import { ChipSelect } from '../components/ChipSelect';
import { DropdownSelect } from '../components/DropdownSelect';
import { LoadingScreen } from '../components/LoadingScreen';
import {
  CONDITION_OPTIONS,
  CURRENCY_OPTIONS,
  DESCRIPTION_MIN_LENGTH,
  LISTING_TYPE_OPTIONS,
  STATUS_LABELS,
  TITLE_MIN_LENGTH,
  sanitizeNonNegative,
} from '../lib/listingOptions';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'EditListing'>;

const NOT_EDITABLE_STATUSES = ['SOLD', 'ARCHIVED', 'BLOCKED'];

function findCategoryLabel(categories: Category[], id: string, prefix = ''): string | null {
  for (const c of categories) {
    const label = prefix ? `${prefix} → ${c.nameUk}` : c.nameUk;
    if (c.id === id) return label;
    const found = findCategoryLabel(c.children, id, label);
    if (found) return found;
  }
  return null;
}

/** Фото, редагування, публікація — RN-порт apps/web/src/app/listings/[id]/edit/page.tsx (без category attributes, Фаза 3 роадмапу). */
export function EditListingScreen({ route }: Props) {
  const { listingId } = route.params;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, accessToken } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [categoryLabel, setCategoryLabel] = useState<string | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [listingType, setListingType] = useState<ListingType>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('UAH');
  const [condition, setCondition] = useState<string | null>(null);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [listingResult, mediaResult, categories] = await Promise.all([
        getListing(listingId, accessToken),
        getListingMedia(listingId),
        getCategoryTree(),
      ]);
      setListing(listingResult);
      setMedia(mediaResult);
      setCategoryLabel(findCategoryLabel(categories, listingResult.categoryId));

      setListingType(listingResult.listingType);
      setTitle(listingResult.title);
      setDescription(listingResult.description ?? '');
      setPrice(listingResult.price === null ? '' : String(listingResult.price));
      setCurrency(listingResult.currency);
      setCondition(listingResult.condition);
      setIsNegotiable(listingResult.isNegotiable);
      setLocationId(listingResult.locationId);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Не вдалося завантажити оголошення.');
    } finally {
      setIsLoading(false);
    }
  }, [listingId, accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getCities().then(setCities).catch(() => setCities([]));
    getRegions().then(setRegions).catch(() => setRegions([]));
  }, []);

  // Одноразово підтягує область для вже збереженого міста (locationId з load(), regions — окремий fetch).
  useEffect(() => {
    if (!locationId || regions.length === 0 || regionId) return;
    const parentRegion = regions.find((r) => r.cities.some((c) => c.id === locationId));
    if (parentRegion) setRegionId(parentRegion.id);
  }, [locationId, regions, regionId]);

  const selectedRegion = useMemo(() => regions.find((r) => r.id === regionId) ?? null, [regions, regionId]);
  const citiesInRegion = selectedRegion?.cities ?? [];

  const isEditable = listing ? !NOT_EDITABLE_STATUSES.includes(listing.status) : false;
  const isOwner = Boolean(user) && Boolean(listing) && listing?.userId === user?.id;

  async function choosePhotoSource() {
    setActionError(null);
    setIsUploading(true);
    try {
      const assets = await pickPhotos();
      if (assets.length === 0 || !accessToken) return;
      for (const asset of assets) {
        await uploadListingMedia(listingId, assetToRNFile(asset), accessToken).catch(() => null);
      }
      const fresh = await getListingMedia(listingId);
      setMedia(fresh);
    } catch (err) {
      setActionError(err instanceof ApiError || err instanceof Error ? err.message : 'Не вдалося завантажити фото.');
    } finally {
      setIsUploading(false);
    }
  }

  async function handlePublish() {
    if (!accessToken) return;
    setActionError(null);
    setIsPublishing(true);
    try {
      await publishListing(listingId, accessToken);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося опублікувати оголошення.');
    } finally {
      setIsPublishing(false);
    }
  }

  const isTitleValid = title.trim().length >= TITLE_MIN_LENGTH;
  const isDescriptionValid = description.trim().length >= DESCRIPTION_MIN_LENGTH;
  const canSave = isTitleValid && isDescriptionValid && Boolean(locationId);

  async function handleSave() {
    if (!accessToken || !listing || !canSave) return;
    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);
    try {
      const updated = await updateListing(
        listingId,
        {
          listingType,
          title,
          description: description || undefined,
          price: price === '' ? undefined : Number(price),
          currency,
          condition: (condition as 'new' | 'used' | 'for_parts') ?? undefined,
          locationId: locationId ?? undefined,
          isNegotiable,
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

  if (isLoading) {
    return (
      <View style={styles.center}>
        <LoadingScreen />
      </View>
    );
  }

  if (loadError || !listing) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError ?? 'Оголошення не знайдено'}</Text>
        <Pressable style={styles.secondaryButton} onPress={load}>
          <Text style={styles.secondaryButtonText}>Спробувати ще раз</Text>
        </Pressable>
      </View>
    );
  }

  if (!isOwner) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Це не ваше оголошення — редагування недоступне.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>{STATUS_LABELS[listing.status]}</Text>
          </View>
          <Text style={styles.title}>{listing.title}</Text>
        </View>
        <Text style={styles.price}>{formatPrice(listing.price, listing.currency)}</Text>

        {actionError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Фото</Text>
          <View style={styles.photoGrid}>
            {media.map((m) => (
              <Image key={m.id} source={{ uri: m.url }} style={styles.photo} />
            ))}
          </View>
          <Pressable style={styles.secondaryButton} onPress={choosePhotoSource} disabled={isUploading}>
            {isUploading ? <ActivityIndicator color={colors.accent[700]} /> : <Text style={styles.secondaryButtonText}>Додати фото</Text>}
          </Pressable>
        </View>

        {!isEditable ? (
          <Text style={styles.hint}>Оголошення в статусі {listing.status} більше не можна редагувати.</Text>
        ) : (
          <>
            {categoryLabel && (
              <Text style={styles.hint}>
                Категорія: <Text style={styles.categoryValue}>{categoryLabel}</Text>
              </Text>
            )}

            {saveMessage && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{saveMessage}</Text>
              </View>
            )}
            {saveError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{saveError}</Text>
              </View>
            )}

            <ChipSelect
              label="Тип оголошення"
              options={LISTING_TYPE_OPTIONS}
              value={listingType}
              onChange={(v) => setListingType(v as ListingType)}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Назва</Text>
              <TextInput value={title} onChangeText={setTitle} style={styles.input} />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Опис</Text>
              <TextInput value={description} onChangeText={setDescription} multiline numberOfLines={4} style={[styles.input, styles.textArea]} />
            </View>

            <View style={styles.priceRow}>
              <View style={[styles.field, styles.priceField]}>
                <Text style={styles.label}>Ціна</Text>
                <TextInput
                  value={price}
                  onChangeText={(v) => setPrice(sanitizeNonNegative(v))}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
              <View style={styles.currencyField}>
                <ChipSelect label="Валюта" options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.label}>Торг можливий</Text>
              <Switch value={isNegotiable} onValueChange={setIsNegotiable} trackColor={{ true: colors.brand[500] }} />
            </View>

            <DropdownSelect
              label="Область"
              options={regions.map((r) => ({ value: r.id, label: r.nameUk }))}
              value={regionId}
              onChange={(v) => {
                setRegionId(v);
                setLocationId(null);
              }}
            />

            <DropdownSelect
              label="Місто"
              options={citiesInRegion.map((c) => ({ value: c.id, label: c.nameUk }))}
              value={locationId}
              onChange={setLocationId}
              emptyHint={regionId ? 'У цій області немає міст' : 'Спочатку оберіть область'}
            />

            <ChipSelect label="Стан" options={CONDITION_OPTIONS} value={condition} onChange={setCondition} />

            <Pressable
              style={[styles.primaryButton, !canSave && styles.primaryButtonDisabled]}
              onPress={handleSave}
              disabled={!canSave || isSaving}
            >
              {isSaving ? <ActivityIndicator color={colors.buttonText} /> : <Text style={styles.primaryButtonText}>Зберегти зміни</Text>}
            </Pressable>
          </>
        )}

        {(listing.status === 'DRAFT' || listing.status === 'REJECTED') && (
          <Pressable style={styles.primaryButton} onPress={handlePublish} disabled={isPublishing}>
            {isPublishing ? <ActivityIndicator color={colors.buttonText} /> : <Text style={styles.primaryButtonText}>Опублікувати</Text>}
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PHOTO_SIZE = 80;

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  container: { padding: 16, paddingBottom: 40, gap: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { backgroundColor: colors.brand[100], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { color: colors.brand[700], fontSize: 12, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, flexShrink: 1 },
  price: { fontSize: 22, fontWeight: '800', color: colors.brand[700] },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: '500', color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted },
  categoryValue: { color: colors.text, fontWeight: '500' },
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
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 12, backgroundColor: colors.border },
  primaryButton: { backgroundColor: colors.accent[600], borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14, alignItems: 'center' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 15 },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  secondaryButtonText: { color: colors.accent[700], fontWeight: '600', fontSize: 13 },
  errorBox: {
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: colors.accent[600], fontSize: 13, textAlign: 'center' },
  successBox: {
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
    borderRadius: 10,
    padding: 12,
  },
  successText: { color: colors.brand[700], fontSize: 13 },
  });
}
