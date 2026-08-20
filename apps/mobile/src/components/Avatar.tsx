import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../lib/theme-context';

const SIZES = { sm: 28, md: 40, lg: 56 };

type AvatarProps = {
  url?: string | null;
  size?: keyof typeof SIZES;
};

export function Avatar({ url, size = 'md' }: AvatarProps) {
  const { colors } = useTheme();
  const px = SIZES[size];

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.image, { width: px, height: px, borderRadius: px / 2, backgroundColor: colors.border }]}
      />
    );
  }

  return (
    <View style={[styles.placeholder, { width: px, height: px, borderRadius: px / 2, backgroundColor: colors.border }]}>
      <Svg width={px * 0.6} height={px * 0.6} viewBox="0 0 24 24" fill={colors.textMuted}>
        <Circle cx="12" cy="8" r="4" />
        <Path d="M4 22c0-5 3.6-9 8-9s8 4 8 9" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {},
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
