import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SearchResultItem } from '../lib/api';
import { formatPrice } from '../lib/format';
import { LISTING_TYPE_OPTIONS } from '../lib/listingOptions';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';

const NEW_BADGE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

type ListingCardProps = {
  item: SearchResultItem;
  onPress: () => void;
};

/** Картка в сітці (Home "Нові оголошення" / Search результати) — RN-порт ListingCard.tsx з веб-версії. */
export function ListingCard({ item, onPress }: ListingCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const isNew =
    !!item.publishedAt && Date.now() - new Date(item.publishedAt).getTime() < NEW_BADGE_THRESHOLD_MS;
  // "Продаю" — типовий, найчастіший тип, бейдж для нього лише зайвий шум на кожній картці.
  const typeLabel = item.listingType !== 'sell' ? LISTING_TYPE_OPTIONS.find((o) => o.value === item.listingType)?.label : null;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.imageWrap}>
        {isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>Нове</Text>
          </View>
        )}
        {typeLabel && (
          <View style={[styles.typeBadge, isNew && styles.typeBadgeBelow]}>
            <Text style={styles.typeBadgeText} numberOfLines={1}>
              {typeLabel}
            </Text>
          </View>
        )}
        {item.mainMediaUrl ? (
          <Image source={{ uri: item.mainMediaUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.noPhoto}>
            <Text style={styles.noPhotoText}>Без фото</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.price}>{formatPrice(item.price, item.currency)}</Text>
        {item.locationName && <Text style={styles.location}>{item.locationName}</Text>}
      </View>
    </Pressable>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageWrap: { aspectRatio: 1, backgroundColor: colors.page },
  image: { width: '100%', height: '100%' },
  newBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    zIndex: 1,
    backgroundColor: colors.highlight[400],
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  newBadgeText: { color: colors.highlight[900], fontSize: 11, fontWeight: '700' },
  typeBadge: {
    position: 'absolute',
    left: 8,
    top: 8,
    maxWidth: '75%',
    zIndex: 1,
    backgroundColor: colors.accent[100],
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  // "Нове" (якщо є) займає верхній лівий кут — тип оголошення тоді нижче, щоб не накладались,
  // особливо коли текст типу довгий ("Віддам безкоштовно").
  typeBadgeBelow: { top: 32 },
  typeBadgeText: { color: colors.accent[700], fontSize: 11, fontWeight: '700' },
  noPhoto: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noPhotoText: { color: colors.textMuted, fontSize: 13 },
  // Фіксована мінімальна висота (а не покладання на flex "stretch" рядка сітки) — локація
  // є не в кожного оголошення, тож без цього картки в одному рядку могли б виглядати різної
  // висоти залежно від платформи.
  info: { padding: 10, gap: 4, minHeight: 84 },
  title: { fontSize: 13, fontWeight: '500', color: colors.text, minHeight: 34 },
  price: { fontWeight: '800', color: colors.brand[700] },
  location: { fontSize: 11, color: colors.textMuted },
  });
}
