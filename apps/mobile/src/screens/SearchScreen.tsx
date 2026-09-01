import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, City, SearchResultItem, createSavedSearch, getCities, search, type SearchParams as ApiSearchParams } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { pluralizeListings } from '../lib/format';
import { CONDITION_OPTIONS } from '../lib/listingOptions';
import { ListingCard } from '../components/ListingCard';
import { LoadingScreen } from '../components/LoadingScreen';
import type { AppNavigation, TabParamList } from '../navigation/types';

const SORT_OPTIONS: { value: NonNullable<ApiSearchParams['sort']>; label: string }[] = [
  { value: 'newest', label: 'Спочатку нові' },
  { value: 'relevance', label: 'За релевантністю' },
  { value: 'price_asc', label: 'Дешевші спочатку' },
  { value: 'price_desc', label: 'Дорожчі спочатку' },
];

type SearchRouteProp = BottomTabScreenProps<TabParamList, 'Search'>['route'];

export function SearchScreen() {
  const navigation = useNavigation<AppNavigation>();
  const route = useRoute<SearchRouteProp>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const { user, accessToken } = useAuth();
  const { q: initialQ, category: initialCategory, categoryName: initialCategoryName, seller } = route.params ?? {};

  const [query, setQuery] = useState(initialQ ?? '');
  const [sort, setSort] = useState<ApiSearchParams['sort']>(initialQ ? 'relevance' : 'newest');
  const [categoryId, setCategoryId] = useState(initialCategory);
  const [categoryName, setCategoryName] = useState(initialCategoryName);
  const [cities, setCities] = useState<City[]>([]);
  const [locationId, setLocationId] = useState<string | undefined>(undefined);
  const [citySearch, setCitySearch] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [condition, setCondition] = useState<string | undefined>(undefined);

  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);

  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCities().then(setCities).catch(() => setCities([]));
  }, []);

  const priceMinNum = priceMin ? Number(priceMin) : undefined;
  const priceMaxNum = priceMax ? Number(priceMax) : undefined;
  const activeFilterCount = [locationId, priceMinNum, priceMaxNum, condition].filter((v) => v !== undefined).length;

  const runSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await search({
        q: query || undefined,
        category: categoryId,
        seller,
        location: locationId,
        priceMin: priceMinNum,
        priceMax: priceMaxNum,
        condition,
        sort,
      });
      setItems(result.items);
      setTotal(result.total);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити результати пошуку.');
    } finally {
      setIsLoading(false);
    }
  }, [query, categoryId, seller, locationId, priceMinNum, priceMaxNum, condition, sort]);

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- запускаємо лише при зміні фільтрів через runSearch, не при кожному ре-рендері
  }, [runSearch]);

  async function onRefresh() {
    setIsRefreshing(true);
    await runSearch();
    setIsRefreshing(false);
  }

  async function loadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await search({
        q: query || undefined,
        category: categoryId,
        seller,
        location: locationId,
        priceMin: priceMinNum,
        priceMax: priceMaxNum,
        condition,
        sort,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вдалося завантажити ще оголошення.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Сортування';
  const cityLabel = cities.find((c) => c.id === locationId)?.nameUk ?? 'Усі міста';

  const filteredCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const q = citySearch.trim().toLowerCase();
    return cities.filter((c) => c.nameUk.toLowerCase().includes(q));
  }, [cities, citySearch]);

  function closeCityModal() {
    setCityModalOpen(false);
    setCitySearch('');
  }

  function clearCategory() {
    setCategoryId(undefined);
    setCategoryName(undefined);
  }

  function resetFilters() {
    setLocationId(undefined);
    setPriceMin('');
    setPriceMax('');
    setCondition(undefined);
  }

  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [saveSearchMessage, setSaveSearchMessage] = useState<string | null>(null);

  async function saveSearch() {
    if (!accessToken) return;
    setIsSavingSearch(true);
    setSaveSearchMessage(null);
    try {
      await createSavedSearch({ queryText: query || undefined, categoryId, filters: sort ? { sort } : undefined }, accessToken);
      setSaveSearchMessage('Пошук збережено');
    } catch (err) {
      setSaveSearchMessage(err instanceof ApiError ? err.message : 'Не вдалося зберегти пошук.');
    } finally {
      setIsSavingSearch(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.searchRow}>
        <View style={[styles.inputWrap, styles.inputWrapFlex]}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Пошук оголошень..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.input}
          />
          {query.length > 0 && (
            <Pressable style={styles.inputClear} onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
        <Pressable style={styles.searchButton} onPress={runSearch}>
          <Text style={styles.searchButtonText}>Знайти</Text>
        </Pressable>
      </View>

      {categoryName && (
        <Pressable style={styles.categoryBadge} onPress={clearCategory}>
          <Text style={styles.categoryBadgeText} numberOfLines={1}>
            Категорія: {categoryName}
          </Text>
          <Ionicons name="close" size={14} color={colors.accent[700]} />
        </Pressable>
      )}

      <View style={styles.filterRow}>
        <Pressable style={styles.filterButton} onPress={() => setSortModalOpen(true)}>
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {sortLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.accent[700]} />
        </Pressable>
        <Pressable style={styles.filterButton} onPress={() => setCityModalOpen(true)}>
          <Text style={styles.filterButtonText} numberOfLines={1}>
            {cityLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.accent[700]} />
        </Pressable>
        <Pressable style={styles.filterButton} onPress={() => setFiltersModalOpen(true)}>
          <Text style={styles.filterButtonText} numberOfLines={1}>
            Фільтри{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
          <Ionicons name="options" size={16} color={colors.accent[700]} />
        </Pressable>
      </View>

      {!isLoading && !error && (
        <View style={styles.resultRow}>
          <Text style={styles.resultCount}>
            Знайдено {total} {pluralizeListings(total)}
          </Text>
          {user && (query || categoryId) && (
            <Pressable onPress={saveSearch} disabled={isSavingSearch} hitSlop={8}>
              <Text style={styles.saveSearchLink}>
                {isSavingSearch ? 'Збереження…' : saveSearchMessage ?? 'Зберегти пошук'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {isLoading ? (
        <LoadingScreen />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={runSearch}>
            <Text style={styles.retryText}>Спробувати ще раз</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.resultsContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.brand[600]} />}
          renderItem={({ item }) => (
            <ListingCard item={item} onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })} />
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>Нічого не знайдено</Text>}
          ListFooterComponent={
            nextCursor ? (
              <Pressable style={styles.loadMoreButton} onPress={loadMore}>
                {isLoadingMore ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <Text style={styles.retryText}>Завантажити ще</Text>
                )}
              </Pressable>
            ) : null
          }
        />
      )}

      <Modal visible={sortModalOpen} transparent animationType="fade" onRequestClose={() => setSortModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Сортування</Text>
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={styles.modalOption}
                  onPress={() => {
                    setSort(option.value);
                    setSortModalOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{option.label}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={colors.accent[600]} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={cityModalOpen} transparent animationType="fade" onRequestClose={closeCityModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeCityModal}>
          <Pressable style={[styles.modalSheet, styles.modalSheetTall]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Місто</Text>
            <TextInput
              value={citySearch}
              onChangeText={setCitySearch}
              placeholder="Пошук міста..."
              placeholderTextColor={colors.textMuted}
              style={styles.modalSearchInput}
            />
            <FlatList
              data={filteredCities}
              keyExtractor={(c) => c.id}
              style={styles.modalList}
              ListHeaderComponent={
                <Pressable
                  style={styles.modalOption}
                  onPress={() => {
                    setLocationId(undefined);
                    closeCityModal();
                  }}
                >
                  <Text style={[styles.modalOptionText, !locationId && styles.modalOptionTextActive]}>Усі міста</Text>
                  {!locationId && <Ionicons name="checkmark" size={18} color={colors.accent[600]} />}
                </Pressable>
              }
              renderItem={({ item }) => {
                const active = locationId === item.id;
                return (
                  <Pressable
                    style={styles.modalOption}
                    onPress={() => {
                      setLocationId(item.id);
                      closeCityModal();
                    }}
                  >
                    <Text style={[styles.modalOptionText, active && styles.modalOptionTextActive]}>{item.nameUk}</Text>
                    {active && <Ionicons name="checkmark" size={18} color={colors.accent[600]} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.modalEmptyText}>Міст не знайдено</Text>}
              keyboardShouldPersistTaps="handled"
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={filtersModalOpen} transparent animationType="fade" onRequestClose={() => setFiltersModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFiltersModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Фільтри</Text>

            <Text style={styles.filterLabel}>Ціна, ₴</Text>
            <View style={styles.priceRow}>
              <TextInput
                value={priceMin}
                onChangeText={(v) => setPriceMin(v.replace(/[^0-9]/g, ''))}
                placeholder="Від"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={[styles.modalSearchInput, styles.priceInput]}
              />
              <TextInput
                value={priceMax}
                onChangeText={(v) => setPriceMax(v.replace(/[^0-9]/g, ''))}
                placeholder="До"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                style={[styles.modalSearchInput, styles.priceInput]}
              />
            </View>

            <Text style={styles.filterLabel}>Стан</Text>
            <View style={styles.conditionRow}>
              {CONDITION_OPTIONS.map((option) => {
                const active = condition === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.conditionChip, active && styles.conditionChipActive]}
                    onPress={() => setCondition(active ? undefined : option.value)}
                  >
                    <Text style={[styles.conditionChipText, active && styles.conditionChipTextActive]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.filtersActionsRow}>
              <Pressable style={styles.resetButton} onPress={resetFilters} disabled={activeFilterCount === 0}>
                <Text style={[styles.resetButtonText, activeFilterCount === 0 && styles.resetButtonTextDisabled]}>
                  Скинути фільтри
                </Text>
              </Pressable>
              <Pressable
                style={styles.applyButton}
                onPress={() => {
                  setFiltersModalOpen(false);
                  runSearch();
                }}
              >
                <Text style={styles.retryText}>Показати</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page, paddingHorizontal: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  inputWrapFlex: { flex: 1 },
  inputIcon: { position: 'absolute', left: 14, zIndex: 1 },
  inputClear: { position: 'absolute', right: 12 },
  searchButton: {
    backgroundColor: colors.accent[600],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  searchButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 14 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingLeft: 40,
    paddingRight: 36,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.accent[50],
    borderWidth: 1,
    borderColor: colors.accent[100],
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 10,
  },
  categoryBadgeText: { color: colors.accent[700], fontSize: 13, fontWeight: '500' },
  filterRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  filterButtonText: { color: colors.accent[700], fontWeight: '500', fontSize: 13, flexShrink: 1 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  resultCount: { color: colors.textMuted, fontSize: 13 },
  saveSearchLink: { color: colors.accent[600], fontSize: 13, fontWeight: '600' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 6 },
  priceRow: { flexDirection: 'row', gap: 10 },
  priceInput: { flex: 1, marginBottom: 0 },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  conditionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  conditionChipActive: { backgroundColor: colors.accent[50], borderColor: colors.accent[600] },
  conditionChipText: { fontSize: 13, color: colors.text },
  conditionChipTextActive: { color: colors.accent[700], fontWeight: '600' },
  filtersActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 },
  resetButton: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  resetButtonText: { color: colors.accent[600], fontWeight: '600', fontSize: 14 },
  resetButtonTextDisabled: { color: colors.textMuted },
  applyButton: {
    flex: 1,
    backgroundColor: colors.accent[600],
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  row: { gap: 12, marginBottom: 12 },
  resultsContent: { paddingTop: 12, paddingBottom: 24, gap: 12 },
  errorBox: { marginTop: 24, alignItems: 'center', gap: 10 },
  errorText: { color: colors.accent[600], textAlign: 'center' },
  retryButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: colors.buttonText, fontWeight: '600' },
  loadMoreButton: {
    backgroundColor: colors.accent[600],
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalSheet: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalSheetTall: { height: '70%' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  modalSearchInput: {
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  modalList: { flexGrow: 0 },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalOptionText: { fontSize: 15, color: colors.text },
  modalOptionTextActive: { color: colors.accent[600], fontWeight: '600' },
  modalEmptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 16 },
  });
}
