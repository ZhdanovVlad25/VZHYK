import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';

type Props = {
  visible: boolean;
  onContinue: () => void;
};

/**
 * Повноекранне підтвердження одразу після відправки оголошення на модерацію — RN-порт
 * apps/web/src/components/listings/ModerationSubmittedOverlay.tsx. Раніше єдиним сигналом
 * було миттєве перескакування на екран редагування, без жодного підтвердження.
 */
export function ModerationSubmittedOverlay({ visible, onContinue }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onContinue}>
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 13l4 4L19 7"
              stroke={colors.brand[600]}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <Text style={styles.title}>Надіслано на модерацію</Text>
        <Text style={styles.message}>
          Оголошення перевірить модератор — зазвичай це займає недовго. Після схвалення воно з’явиться в пошуку.
        </Text>
        <Pressable style={styles.button} onPress={onContinue}>
          <Text style={styles.buttonText}>Перейти до оголошення</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.brand[100],
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8, textAlign: 'center' },
    message: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 32, maxWidth: 320, lineHeight: 20 },
    button: { backgroundColor: colors.accent[600], borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
    buttonText: { color: colors.buttonText, fontWeight: '600', fontSize: 15 },
  });
}
