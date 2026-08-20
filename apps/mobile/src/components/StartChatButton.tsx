import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiError, createChat } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import type { AppNavigation } from '../navigation/types';

/** "Написати продавцю" — RN-порт StartChatButton.tsx. */
export function StartChatButton({ listingId, ownerId }: { listingId: string; ownerId: string }) {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.id === ownerId) {
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
      const chat = await createChat(ownerId, listingId, accessToken);
      navigation.navigate('ChatThread', { chatId: chat.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося почати чат.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View>
      <Pressable style={styles.button} onPress={handlePress} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color={colors.buttonText} size="small" /> : <Text style={styles.text}>Написати продавцю</Text>}
      </Pressable>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    button: {
      alignSelf: 'flex-start',
      backgroundColor: colors.accent[600],
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    text: { color: colors.buttonText, fontWeight: '600', fontSize: 13 },
    errorText: { color: colors.accent[600], fontSize: 12, marginTop: 4 },
  });
}
