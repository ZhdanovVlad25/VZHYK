import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiError, Category, SavedSearch, deleteSavedSearch, getCategoryTree, getSavedSearches } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { formatRelativeDate } from '../lib/format';
import { LoadingScreen } from '../components/LoadingScreen';
import type { AppNavigation } from '../navigation/types';

function flattenCategoryLabels(categories: Category[], prefix = ''): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) {
    const label = prefix ? `${prefix} → ${c.nameUk}` : c.nameUk;
    map.set(c.id, label);
    for (const [id, childLabel] of flattenCategoryLabels(c.children, label)) {
      map.set(id, childLabel);
    }
  }
  return map;
}

/** "Збережені пошуки" — RN-порт apps/web/src/app/saved-searches/page.tsx. */
export function SavedSearchesScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { accessToken } = useAuth();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const [searches, categories] = await Promise.all([getSavedSearches(accessToken), getCategoryTree()]);
      setItems(searches);
      setCategoryLabels(flattenCategoryLabels(categories));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити збережені пошуки.');
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

  async function handleRemove(id: string) {
    if (!accessToken) return;
    setRemovingId(id);
    try {
      await deleteSavedSearch(id, accessToken);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.brand[600]} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.queryText ? `«${item.queryText}»` : 'Усі оголошення'}
                {item.categoryId && (
                  <Text style={styles.rowCategory}> · {categoryLabels.get(item.categoryId) ?? 'Категорія'}</Text>
                )}
              </Text>
              <Text style={styles.rowDate}>Збережено {formatRelativeDate(item.createdAt).exact}</Text>
            </View>
            <View style={styles.rowActions}>
              <Pressable
                style={styles.findButton}
                onPress={() =>
                  navigation.navigate('Tabs', {
                    screen: 'Search',
                    params: { q: item.queryText ?? undefined, category: item.categoryId ?? undefined },
                  })
                }
              >
                <Text style={styles.findButtonText}>Знайти</Text>
              </Pressable>
              <Pressable style={styles.removeButton} onPress={() => handleRemove(item.id)} disabled={removingId === item.id}>
                {removingId === item.id ? (
                  <ActivityIndicator color={colors.textMuted} size="small" />
                ) : (
                  <Text style={styles.removeButtonText}>Видалити</Text>
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
              Збережених пошуків немає. На сторінці пошуку натисніть «Зберегти пошук», щоб швидко повертатись до нього.
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
    rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    rowCategory: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
    rowDate: { fontSize: 12, color: colors.textMuted },
    rowActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    findButton: {
      backgroundColor: colors.accent[600],
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    findButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 13 },
    removeButton: { paddingVertical: 8 },
    removeButtonText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
    errorBox: { alignItems: 'center', gap: 10, marginTop: 24 },
    errorText: { color: colors.accent[600], textAlign: 'center' },
    retryButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    retryButtonText: { color: colors.buttonText, fontWeight: '600' },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  });
}
