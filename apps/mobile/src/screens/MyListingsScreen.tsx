import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiError, Listing, ListingStatus, deleteListing, getMyListings } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { formatPrice } from '../lib/format';
import { ChipSelect } from '../components/ChipSelect';
import { LoadingScreen } from '../components/LoadingScreen';
import { STATUS_LABELS } from '../lib/listingOptions';
import type { AppNavigation } from '../navigation/types';

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Усі статуси' },
  ...(Object.keys(STATUS_LABELS) as ListingStatus[]).map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** "Мої оголошення" — RN-порт apps/web/src/app/my-listings/page.tsx, доступний з таба "Профіль". */
export function MyListingsScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { accessToken } = useAuth();

  const [status, setStatus] = useState('ALL');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMyListings(accessToken, status === 'ALL' ? undefined : (status as ListingStatus));
      setListings(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити ваші оголошення.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  function confirmDelete(listing: Listing) {
    Alert.alert('Видалити оголошення?', `«${listing.title}» — це незворотно.`, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Видалити', style: 'destructive', onPress: () => handleDelete(listing) },
    ]);
  }

  async function handleDelete(listing: Listing) {
    if (!accessToken) return;
    setDeletingId(listing.id);
    setError(null);
    try {
      await deleteListing(listing.id, accessToken);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося видалити оголошення.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listings}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.brand[600]} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ChipSelect label="Статус" options={STATUS_FILTER_OPTIONS} value={status} onChange={setStatus} />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable style={styles.rowInfo} onPress={() => navigation.navigate('EditListing', { listingId: item.id })}>
              <View style={styles.rowHeader}>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status]}</Text>
                </View>
                <Text style={styles.rowDate}>Створено {formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowMeta}>
                {formatPrice(item.price, item.currency)} · {item.viewsCount} переглядів
              </Text>
            </Pressable>
            <View style={styles.rowActions}>
              <Pressable style={styles.editButton} onPress={() => navigation.navigate('EditListing', { listingId: item.id })}>
                <Text style={styles.editButtonText}>{item.status === 'DRAFT' ? 'Редагувати' : 'Переглянути'}</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={() => confirmDelete(item)} disabled={deletingId === item.id}>
                {deletingId === item.id ? (
                  <ActivityIndicator color={colors.accent[600]} size="small" />
                ) : (
                  <Text style={styles.deleteButtonText}>Видалити</Text>
                )}
              </Pressable>
            </View>
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
            <Text style={styles.emptyText}>
              {status === 'ALL' ? 'Ви ще не створювали оголошень.' : 'У цьому статусі немає оголошень.'}
            </Text>
          )
        }
      />
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  listContent: { padding: 16, gap: 10 },
  header: { marginBottom: 12 },
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
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { backgroundColor: colors.brand[100], borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  statusBadgeText: { color: colors.brand[700], fontSize: 11, fontWeight: '600' },
  rowDate: { fontSize: 11, color: colors.textMuted },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowMeta: { fontSize: 13, color: colors.textMuted },
  rowActions: { flexDirection: 'row', gap: 8 },
  editButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  editButtonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  deleteButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent[100],
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  deleteButtonText: { color: colors.accent[600], fontWeight: '600', fontSize: 13 },
  errorBox: { alignItems: 'center', gap: 10, marginTop: 24 },
  errorText: { color: colors.accent[600], textAlign: 'center' },
  retryButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryButtonText: { color: colors.buttonText, fontWeight: '600' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  });
}
