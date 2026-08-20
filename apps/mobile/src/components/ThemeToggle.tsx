import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../lib/theme-context';

/** Перемикач світла/темна — той самий сонце/місяць SVG, що web ThemeToggle.tsx. */
export function ThemeToggle() {
  const { theme, colors, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Pressable
      onPress={toggleTheme}
      style={[styles.button, { borderColor: colors.border, backgroundColor: colors.white }]}
      accessibilityRole="button"
      accessibilityLabel={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
    >
      {isDark ? (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round">
          <Circle cx={12} cy={12} r={4} />
          <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </Svg>
      ) : (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill={colors.text}>
          <Path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 1020.354 15.354z" />
        </Svg>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
