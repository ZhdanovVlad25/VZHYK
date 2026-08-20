import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';

type Option = { value: string; label: string };

type ChipSelectProps = {
  label: string;
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  emptyHint?: string;
};

/** Каскадні селектори (категорія→підкатегорія, область→місто) та фіксовані набори (тип/валюта/стан) — одна й та сама чіп-розкладка по всьому застосунку (Search screen). */
export function ChipSelect({ label, options, value, onChange, emptyHint }: ChipSelectProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {options.length === 0 ? (
        <Text style={styles.emptyHint}>{emptyHint ?? '—'}</Text>
      ) : (
        <View style={styles.chipRow}>
          {options.map((opt) => {
            const active = value === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChange(opt.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    wrap: { gap: 8 },
    label: { fontSize: 14, fontWeight: '500', color: colors.text },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chipActive: { backgroundColor: colors.accent[600], borderColor: colors.accent[600] },
    chipText: { color: colors.accent[700], fontWeight: '500', fontSize: 13 },
    chipTextActive: { color: colors.buttonText },
    emptyHint: { color: colors.textMuted, fontSize: 13 },
  });
}
