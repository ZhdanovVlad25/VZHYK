import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../lib/language-context';
import { useTheme } from '../lib/theme-context';
import type { Language } from '../lib/i18n';

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'uk', label: 'УКР' },
  { value: 'en', label: 'EN' },
];

/** УКР/EN сегментований перемикач — той самий, що web LanguageToggle.tsx. */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const { colors } = useTheme();

  return (
    <View style={[styles.group, { borderColor: colors.border }]}>
      {OPTIONS.map((option) => {
        const active = language === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => setLanguage(option.value)}
            style={[styles.option, active && { backgroundColor: colors.accent[600] }]}
          >
            <Text style={[styles.optionText, { color: active ? colors.buttonText : colors.textMuted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderRadius: 999, borderWidth: 1, padding: 2 },
  option: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  optionText: { fontSize: 12, fontWeight: '700' },
});
