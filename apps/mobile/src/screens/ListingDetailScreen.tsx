import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Category,
  CategoryAttribute,
  City,
  Listing,
  ListingStatus,
  Media,
  getCategoryAttributes,
  getCategoryTree,
  getCities,
  getListing,
  getListingMedia,
} from '../lib/api';
import { formatPrice, formatRelativeDate, parseDescription, pluralizeViews } from '../lib/format';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { CONDITION_OPTIONS, LISTING_TYPE_OPTIONS } from '../lib/listingOptions';
import { FavoriteButton } from '../components/FavoriteButton';
import { ListingGallery } from '../components/ListingGallery';
import { LoadingScreen } from '../components/LoadingScreen';
import { ReportButton } from '../components/ReportButton';
import { SellerCard } from '../components/SellerCard';
import { PriceOfferButton } from '../components/PriceOfferButton';
import { SellerPhoneButton } from '../components/SellerPhoneButton';
import { StartChatButton } from '../components/StartChatButton';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ListingDetail'>;

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

function formatAttributeValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Так' : 'Ні';
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') {
    const range = value as { min?: unknown; max?: unknown };
    if ('min' in range || 'max' in range) return `${range.min ?? '?'} – ${range.max ?? '?'}`;
  }
  return String(value);
}

export function ListingDetailScreen({ route }: Props) {
  const { listingId } = route.params;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [listing, setListing] = useState<Listing | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categoryTree, setCategoryTree] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getListing(listingId)
      .then((l) => {
        if (cancelled) return;
        setListing(l);
        Promise.all([
          getListingMedia(listingId).catch(() => []),
          getCategoryAttributes(l.categoryId).catch(() => []),
          getCities().catch(() => []),
          getCategoryTree().catch(() => []),
        ]).then(([mediaRes, attrRes, citiesRes, categoryTreeRes]) => {
          if (cancelled) return;
          setMedia(mediaRes);
          setAttributes(attrRes);
          setCities(citiesRes);
          setCategoryTree(categoryTreeRes);
        });
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Помилка мережі'));
    return () => {
      cancelled = true;
    };
  }, [listingId]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={styles.center}>
        <LoadingScreen />
      </View>
    );
  }

  const cityName = listing.locationId ? cities.find((c) => c.id === listing.locationId)?.nameUk ?? null : null;
  const attributeLabelById = new Map(attributes.map((a) => [a.id, a.labelUk]));
  const mainMedia = media.find((m) => m.isMain) ?? media[0];
  const sortedMedia = mainMedia ? [mainMedia, ...media.filter((m) => m.id !== mainMedia.id)] : media;
  const listingTypeLabel = LISTING_TYPE_OPTIONS.find((o) => o.value === listing.listingType)?.label;
  const conditionLabel = CONDITION_OPTIONS.find((o) => o.value === listing.condition)?.label;
  // Топ-категорія оголошення (навіть якщо categoryId — підкатегорія) — потрібна лише для
  // звуження діапазону слайдера "Хочу дешевше" на авто/нерухомості (PriceOfferButton).
  const topCategoryName =
    categoryTree.find((c) => c.id === listing.categoryId)?.nameUk ??
    categoryTree.find((c) => c.children.some((child) => child.id === listing.categoryId))?.nameUk ??
    null;
  const publishedDate = listing.publishedAt ? formatRelativeDate(listing.publishedAt) : null;
  const listingRef = listing.id.slice(0, 8).toUpperCase();

  function handleShare() {
    Share.share({ message: `${listing!.title} — ${formatPrice(listing!.price, listing!.currency)}` });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <ListingGallery media={sortedMedia} title={listing.title} />

      <View style={styles.content}>
        <View style={styles.statusRow}>
          <View style={styles.badgesGroup}>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{STATUS_LABELS[listing.status] ?? listing.status}</Text>
            </View>
            {listingTypeLabel && (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{listingTypeLabel}</Text>
              </View>
            )}
            <Text style={styles.viewsText}>{listing.viewsCount} {pluralizeViews(listing.viewsCount)}</Text>
          </View>
          <View style={styles.actionsGroup}>
            <Pressable onPress={handleShare} hitSlop={8}>
              <Text style={styles.shareText}>Поділитись</Text>
            </Pressable>
            <FavoriteButton listingId={listing.id} />
          </View>
        </View>

        <Text style={styles.title}>{listing.title}</Text>
        <Text style={styles.price}>{formatPrice(listing.price, listing.currency)}</Text>
        {listing.isNegotiable && <Text style={styles.hint}>Торг можливий</Text>}
        {(cityName || conditionLabel) && (
          <Text style={styles.city}>{[cityName, conditionLabel].filter(Boolean).join(' · ')}</Text>
        )}
        <Text style={styles.meta}>
          {publishedDate && `Опубліковано ${publishedDate.label} · `}№ {listingRef}
        </Text>

        <View style={styles.actionsRow}>
          <StartChatButton listingId={listing.id} ownerId={listing.userId} />
          <SellerPhoneButton sellerId={listing.userId} />
          {listing.price !== null && (
            <PriceOfferButton
              listingId={listing.id}
              ownerId={listing.userId}
              price={listing.price}
              currency={listing.currency}
              topCategoryName={topCategoryName}
            />
          )}
        </View>

        <SellerCard sellerId={listing.userId} />

        <View style={styles.reportRow}>
          <ReportButton targetType="LISTING" targetId={listing.id} />
        </View>

        {listing.description && (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionTitle}>Опис</Text>
            {parseDescription(listing.description).map((block, index) =>
              block.type === 'list' ? (
                <View key={index} style={styles.descriptionList}>
                  {block.lines.map((line, lineIndex) => (
                    <View key={lineIndex} style={styles.descriptionListItem}>
                      <Text style={styles.descriptionListBullet}>•</Text>
                      <Text style={styles.description}>{line}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text key={index} style={styles.descriptionParagraph}>
                  {block.lines[0]}
                </Text>
              ),
            )}
          </View>
        )}

        {listing.attributes.length > 0 && (
          <View style={styles.attributesCard}>
            <Text style={styles.attributesTitle}>Характеристики</Text>
            {listing.attributes.map((attr) => (
              <View key={attr.id} style={styles.attributeRow}>
                <Text style={styles.attributeLabel}>{attributeLabelById.get(attr.categoryAttributeId) ?? '—'}</Text>
                <Text style={styles.attributeValue}>{formatAttributeValue(attr.value)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center', padding: 16 },
  content: { padding: 16 },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  badgesGroup: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexShrink: 1 },
  actionsGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionsRow: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBadge: { backgroundColor: colors.brand[100], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { color: colors.brand[700], fontSize: 12, fontWeight: '600' },
  typeBadge: { backgroundColor: colors.highlight[100], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  typeBadgeText: { color: colors.highlight[900], fontSize: 12, fontWeight: '600' },
  shareText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  reportRow: { marginTop: 10, alignItems: 'flex-start' },
  viewsText: { color: colors.textMuted, fontSize: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  price: { fontSize: 26, fontWeight: '800', color: colors.brand[700], marginTop: 6 },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  city: { fontSize: 14, fontWeight: '500', color: colors.text, marginTop: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  descriptionCard: {
    marginTop: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
  },
  descriptionTitle: { fontWeight: '600', color: colors.text, marginBottom: 8 },
  descriptionParagraph: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 8 },
  descriptionList: { marginBottom: 8, gap: 4 },
  descriptionListItem: { flexDirection: 'row', gap: 6 },
  descriptionListBullet: { fontSize: 15, color: colors.text, lineHeight: 22 },
  description: { fontSize: 15, color: colors.text, lineHeight: 22, flex: 1 },
  attributesCard: {
    marginTop: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  attributesTitle: { fontWeight: '600', color: colors.text, marginBottom: 4 },
  attributeRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  attributeLabel: { color: colors.textMuted, fontSize: 13 },
  attributeValue: { color: colors.text, fontSize: 13, fontWeight: '500' },
  errorText: { color: colors.accent[600], textAlign: 'center' },
  });
}
