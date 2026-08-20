import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Category, SearchResultItem, getCategoryTree, search } from '../lib/api';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { useLanguage } from '../lib/language-context';
import { Logo } from '../components/Logo';
import { ListingCard } from '../components/ListingCard';
import { LoadingScreen } from '../components/LoadingScreen';
import type { AppNavigation } from '../navigation/types';

export function HomeScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  /** Ротація tint-фонів категорій — той самий набір, що CATEGORY_TINTS у apps/web/src/app/page.tsx. */
  const CATEGORY_TINTS = [colors.brand[100], colors.accent[100], colors.highlight[100]];
  const CATEGORY_TEXT_COLORS = [colors.brand[700], colors.accent[700], colors.highlight[900]];

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [listings, setListings] = useState<SearchResultItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return Promise.all([getCategoryTree(), search({ sort: 'newest', limit: 15 })])
      .then(([categoriesRes, searchRes]) => {
        setCategories(categoriesRes);
        setListings(searchRes.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Помилка мережі'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }

  const isLoading = categories === null && listings === null && !error;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={listings ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.brand[600]} />}
        renderItem={({ item }) => (
          <ListingCard item={item} onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })} />
        )}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Logo size={36} />
              <Text style={styles.title}>Вжик</Text>
            </View>

            {isLoading && <LoadingScreen />}

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <Pressable style={styles.retryButton} onPress={load}>
                  <Text style={styles.retryText}>Спробувати ще раз</Text>
                </Pressable>
              </View>
            )}

            {categories && categories.length > 0 && (
              <>
                <Pressable
                  style={styles.categoriesHeader}
                  onPress={() => setCategoriesExpanded((prev) => !prev)}
                >
                  <Text style={styles.sectionTitle}>Категорії</Text>
                  <Ionicons
                    name={categoriesExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
                {categoriesExpanded && (
                  <View style={styles.chipWrap}>
                    {categories.map((category, index) => (
                      <Pressable
                        key={category.id}
                        style={[styles.chip, { backgroundColor: CATEGORY_TINTS[index % CATEGORY_TINTS.length] }]}
                        onPress={() => navigation.navigate('Search', { category: category.id, categoryName: category.nameUk })}
                      >
                        <Text style={[styles.chipText, { color: CATEGORY_TEXT_COLORS[index % CATEGORY_TEXT_COLORS.length] }]}>
                          {category.nameUk}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            )}

            {listings && listings.length > 0 && (
              <View style={styles.newestHeader}>
                <Text style={styles.sectionTitle}>{t('newListings')}</Text>
                <Pressable onPress={() => navigation.navigate('Search', {})}>
                  <Text style={styles.viewAll}>{t('viewAll')}</Text>
                </Pressable>
              </View>
            )}

            {listings && listings.length === 0 && !isLoading && (
              <Text style={styles.emptyText}>Поки немає оголошень</Text>
            )}
          </>
        }
      />
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.page },
    listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
    row: { gap: 12, marginBottom: 12 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.brand[600] },
    categoriesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, marginBottom: 4 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 16 },
    chip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    chipText: { fontWeight: '500', fontSize: 13 },
    newestHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, marginTop: 4 },
    viewAll: { color: colors.accent[600], fontSize: 14, fontWeight: '700' },
    errorBox: { marginTop: 24, alignItems: 'center', gap: 10 },
    errorText: { color: colors.accent[600], textAlign: 'center' },
    retryButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
    retryText: { color: colors.buttonText, fontWeight: '600' },
    emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  });
}
