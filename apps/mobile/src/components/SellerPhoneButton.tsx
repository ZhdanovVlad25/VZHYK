import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiError, getPublicProfile } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import type { AppNavigation } from '../navigation/types';

/** "Показати телефон" — RN-порт apps/web/src/components/listings/SellerPhoneButton.tsx. */
export function SellerPhoneButton({ sellerId }: { sellerId: string }) {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, accessToken } = useAuth();
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.id === sellerId) {
    return null;
  }

  async function handlePress() {
    if (!user || !accessToken) {
      navigation.navigate('Tabs', { screen: 'Profile' });
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const profile = await getPublicProfile(sellerId, accessToken);
      if (profile.phone) {
        setPhone(profile.phone);
      } else if (!profile.acceptsCalls) {
        setError('Продавець приймає лише повідомлення в чаті.');
      } else {
        setError('Продавець не показує номер телефону.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося отримати номер телефону.');
    } finally {
      setIsLoading(false);
    }
  }

  if (phone) {
    return (
      <Pressable style={styles.button} onPress={() => Linking.openURL(`tel:${phone}`)}>
        <Text style={styles.buttonText}>{phone}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.button} onPress={handlePress} disabled={isLoading}>
      <Text style={styles.buttonText}>{isLoading ? 'Завантаження…' : 'Показати телефон'}</Text>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </Pressable>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    button: {
      alignSelf: 'flex-start',
      backgroundColor: colors.brand[50],
      borderWidth: 1,
      borderColor: colors.brand[100],
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    buttonText: { color: colors.brand[700], fontWeight: '600', fontSize: 13 },
    errorText: { color: colors.accent[600], fontSize: 11, marginTop: 4 },
  });
}
