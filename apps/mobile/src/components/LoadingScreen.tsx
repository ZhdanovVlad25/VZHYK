import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { Logo } from './Logo';

type LoadingScreenProps = {
  size?: number;
  style?: ViewStyle;
};

/**
 * Брендований індикатор завантаження на весь екран — маскот "Вжик" замість
 * системного ActivityIndicator, для першого завантаження даних на екрані
 * (не для інлайн-спінерів усередині кнопок).
 */
export function LoadingScreen({ size = 56, style }: LoadingScreenProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 550,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale]);

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Logo size={size} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
});
