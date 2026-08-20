import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';

type Option = { value: string; label: string };

type DropdownSelectProps = {
  label: string;
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyHint?: string;
  searchPlaceholder?: string;
  /** Список ще підвантажується — поле не мало показувати "порожньо" (emptyHint) в цей момент,
      бо це виглядає як непрацююче поле (напр. "Область" завжди має опції, окрім миті завантаження). */
  isLoading?: boolean;
};

/**
 * Компактний селект для довгих списків (область, місто) — Pressable-поле, що
 * відкриває модалку з пошуком і вертикальним списком, замість ChipSelect,
 * який для десятків опцій розростається в екран чіпів (ChipSelect лишається
 * для коротких фіксованих наборів: тип/валюта/стан).
 */
export function DropdownSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Оберіть...',
  emptyHint,
  searchPlaceholder = 'Пошук...',
  isLoading = false,
}: DropdownSelectProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedLabel = options.find((o) => o.value === value)?.label ?? null;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {isLoading ? (
        <View style={styles.field}>
          <ActivityIndicator size="small" color={colors.textMuted} />
        </View>
      ) : options.length === 0 ? (
        <Text style={styles.emptyHint}>{emptyHint ?? '—'}</Text>
      ) : (
        <Pressable style={styles.field} onPress={() => setOpen(true)}>
          <Text style={[styles.fieldText, !selectedLabel && styles.fieldPlaceholder]} numberOfLines={1}>
            {selectedLabel ?? placeholder}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
            <FlatList
              data={filtered}
              keyExtractor={(o) => o.value}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = value === item.value;
                return (
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      onChange(item.value);
                      close();
                    }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {active && <Ionicons name="checkmark" size={18} color={colors.accent[600]} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.emptyListText}>Нічого не знайдено</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    wrap: { gap: 8 },
    label: { fontSize: 14, fontWeight: '500', color: colors.text },
    emptyHint: { color: colors.textMuted, fontSize: 13 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 8,
    },
    fieldText: { flex: 1, fontSize: 15, color: colors.text },
    fieldPlaceholder: { color: colors.textMuted },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
    sheet: { backgroundColor: colors.white, borderRadius: 16, padding: 16, height: '70%' },
    sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
    searchInput: {
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
    list: { flexGrow: 0 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionText: { fontSize: 15, color: colors.text, flex: 1, marginRight: 8 },
    optionTextActive: { color: colors.accent[600], fontWeight: '600' },
    emptyListText: { color: colors.textMuted, textAlign: 'center', marginTop: 16 },
  });
}
