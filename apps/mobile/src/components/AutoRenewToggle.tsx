import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';

const DISMISS_KEY = 'vzhyk:autorenew-tip-dismissed';

type AutoRenewToggleProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

/** RN-порт apps/web/src/components/listings/AutoRenewToggle.tsx — AsyncStorage замість localStorage. */
export function AutoRenewToggle({ checked, disabled, onChange }: AutoRenewToggleProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((stored) => {
      if (!stored) setShowTip(true);
    });
  }, []);

  function dismissTip() {
    setShowTip(false);
    AsyncStorage.setItem(DISMISS_KEY, '1').catch(() => {});
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.textCol}>
          <Text style={styles.label}>Автопродовження</Text>
          <Text style={styles.description}>
            {checked
              ? 'Оголошення автоматично продовжуватиметься після закінчення терміну дії.'
              : 'Відображення оголошення не буде автоматично продовжуватись по закінченню строку його дії.'}
          </Text>
        </View>
        <Switch value={checked} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.brand[500] }} />
      </View>

      {showTip && (
        <View style={styles.tip}>
          <Text style={styles.tipText}>Оголошення активні протягом 30 днів, але ви можете продовжувати їх скільки завгодно.</Text>
          <Pressable onPress={dismissTip} hitSlop={8}>
            <Text style={styles.tipButton}>ОК, зрозуміло</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    wrap: { gap: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
    },
    textCol: { flex: 1, gap: 2 },
    label: { fontSize: 14, fontWeight: '600', color: colors.text },
    description: { fontSize: 12, color: colors.textMuted },
    tip: {
      backgroundColor: colors.brand[900],
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    tipText: { color: colors.white, fontSize: 13, lineHeight: 18 },
    tipButton: { color: colors.white, fontWeight: '700', fontSize: 12, textAlign: 'right', textTransform: 'uppercase' },
  });
}
