import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiError, FavoriteView, getFavorites, removeFavorite } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { formatPrice } from '../lib/format';
import { LoadingScreen } from '../components/LoadingScreen';
import type { AppNavigation } from '../navigation/types';

/** "Обране" — RN-порт apps/web/src/app/favorites/page.tsx. */
export function FavoritesScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { accessToken } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      setFavorites(await getFavorites(accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити обране.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  async function handleRemove(listingId: string) {
    if (!accessToken) return;
    setRemovingId(listingId);
    try {
      await removeFavorite(listingId, accessToken);
      setFavorites((prev) => prev.filter((f) => f.listingId !== listingId));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        keyExtractor={(f) => f.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.brand[600]} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.rowInfo}
              disabled={item.isUnavailable}
              onPress={() => navigation.navigate('ListingDetail', { listingId: item.listingId })}
            >
              {item.isUnavailable && (
                <View style={[styles.badge, styles.badgeDanger]}>
                  <Text style={styles.badgeDangerText}>Недоступне</Text>
                </View>
              )}
              {!item.isUnavailable && item.priceChanged && (
                <View style={[styles.badge, styles.badgeWarning]}>
                  <Text style={styles.badgeWarningText}>Ціна змінилась</Text>
                </View>
              )}
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.listing.title}
              </Text>
              <Text style={styles.rowPrice}>{formatPrice(item.listing.price, item.listing.currency)}</Text>
            </Pressable>
            <Pressable style={styles.removeButton} onPress={() => handleRemove(item.listingId)} disabled={removingId === item.listingId}>
              {removingId === item.listingId ? (
                <ActivityIndicator color={colors.textMuted} size="small" />
              ) : (
                <Text style={styles.removeButtonText}>Прибрати</Text>
              )}
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <LoadingScreen />
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={load}>
                <Text style={styles.retryButtonText}>Спробувати ще раз</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.emptyText}>Тут поки порожньо. Додавайте оголошення в обране, щоб швидко до них повертатись.</Text>
          )
        }
      />
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  listContent: { padding: 16 },
  row: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  rowInfo: { gap: 4 },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeDanger: { backgroundColor: colors.accent[50] },
  badgeDangerText: { color: colors.accent[600], fontSize: 11, fontWeight: '600' },
  badgeWarning: { backgroundColor: colors.highlight[100] },
  badgeWarningText: { color: colors.highlight[900], fontSize: 11, fontWeight: '600' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowPrice: { fontSize: 13, color: colors.textMuted },
  removeButton: { alignSelf: 'flex-start' },
  removeButtonText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  errorBox: { alignItems: 'center', gap: 10, marginTop: 24 },
  errorText: { color: colors.accent[600], textAlign: 'center' },
  retryButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryButtonText: { color: colors.buttonText, fontWeight: '600' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  });
}
