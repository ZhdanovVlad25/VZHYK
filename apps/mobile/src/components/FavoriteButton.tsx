import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { addFavorite, getFavorites, removeFavorite } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import type { AppNavigation } from '../navigation/types';

/** Немає ендпоінта "чи в обраному один listing" — стан вичитується зі списку GET /favorites, той самий підхід, що FavoriteButton.tsx на вебі. */
export function FavoriteButton({ listingId }: { listingId: string }) {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, accessToken } = useAuth();
  const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setIsFavorite(null);
      return;
    }
    let cancelled = false;
    getFavorites(accessToken)
      .then((favorites) => {
        if (!cancelled) setIsFavorite(favorites.some((f) => f.listingId === listingId));
      })
      .catch(() => {
        if (!cancelled) setIsFavorite(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, listingId]);

  async function toggle() {
    if (!user || !accessToken) {
      navigation.navigate('Tabs', { screen: 'Profile' });
      return;
    }
    setIsSubmitting(true);
    try {
      if (isFavorite) {
        await removeFavorite(listingId, accessToken);
        setIsFavorite(false);
      } else {
        await addFavorite(listingId, accessToken);
        setIsFavorite(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCheckingStatus = Boolean(accessToken) && isFavorite === null;

  return (
    <Pressable style={styles.button} onPress={toggle} disabled={isSubmitting || isCheckingStatus}>
      {isSubmitting || isCheckingStatus ? (
        <ActivityIndicator color={colors.accent[700]} size="small" />
      ) : (
        <Text style={styles.text}>{isFavorite ? '★ В обраному' : '☆ В обране'}</Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  text: { color: colors.accent[700], fontWeight: '600', fontSize: 13 },
  });
}
