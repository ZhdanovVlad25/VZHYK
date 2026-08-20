import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { ApiError, createChat, sendChatMessage } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { formatPrice } from '../lib/format';
import type { AppNavigation } from '../navigation/types';

const DEFAULT_MIN_RATIO = 0.7;
// Авто/нерухомість — великі, зазвичай уже "твердо" оцінені суми; торг на третину ціни
// тут виглядає несерйозно (і те саме для доларових оголошень — валюта сама по собі
// сигналить вищий цінник/міжнародний товар, де запас на торг менший).
const NARROW_MIN_RATIO = 0.9;
const NARROW_RANGE_CATEGORIES = ['Авто', 'Нерухомість'];

/** "Хочу дешевше" — RN-порт PriceOfferButton.tsx з веб-версії. */
export function PriceOfferButton({
  listingId,
  ownerId,
  price,
  currency,
  topCategoryName,
}: {
  listingId: string;
  ownerId: string;
  price: number;
  currency: string;
  topCategoryName?: string | null;
}) {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, accessToken } = useAuth();
  const isNarrowRange =
    (topCategoryName && NARROW_RANGE_CATEGORIES.includes(topCategoryName)) || currency === 'USD';
  const min = Math.round(price * (isNarrowRange ? NARROW_MIN_RATIO : DEFAULT_MIN_RATIO));
  const [isOpen, setIsOpen] = useState(false);
  const [offer, setOffer] = useState(min);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.id === ownerId) {
    return null;
  }

  function handleToggle() {
    if (!user || !accessToken) {
      navigation.navigate('Tabs', { screen: 'Profile' });
      return;
    }
    setIsOpen((v) => !v);
  }

  async function handleSend() {
    if (!accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const chat = await createChat(ownerId, listingId, accessToken);
      await sendChatMessage(
        chat.id,
        `Пропоную ціну: ${formatPrice(offer, currency)} (замість ${formatPrice(price, currency)})`,
        accessToken,
      );
      navigation.navigate('ChatThread', { chatId: chat.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося надіслати пропозицію.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View>
      <Pressable style={styles.button} onPress={handleToggle}>
        <Text style={styles.buttonText}>Хочу дешевше</Text>
      </Pressable>

      {isOpen && (
        <View style={styles.panel}>
          <Text style={styles.offerText}>{formatPrice(offer, currency)}</Text>
          <Slider
            style={styles.slider}
            minimumValue={min}
            maximumValue={price}
            value={offer}
            step={1}
            onValueChange={setOffer}
            minimumTrackTintColor={colors.brand[600]}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.brand[600]}
          />
          <View style={styles.rangeRow}>
            <Text style={styles.rangeText}>{formatPrice(min, currency)}</Text>
            <Text style={styles.rangeText}>{formatPrice(price, currency)}</Text>
          </View>
          <Pressable style={styles.sendButton} onPress={handleSend} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color={colors.buttonText} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Надіслати пропозицію</Text>
            )}
          </Pressable>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    button: {
      alignSelf: 'flex-start',
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    buttonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
    panel: {
      marginTop: 8,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      width: 260,
    },
    offerText: { fontSize: 16, fontWeight: '700', color: colors.brand[700], marginBottom: 4 },
    slider: { width: '100%', height: 32 },
    rangeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
    rangeText: { fontSize: 11, color: colors.textMuted },
    sendButton: { marginTop: 10, backgroundColor: colors.accent[600], borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    sendButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 13 },
    errorText: { color: colors.accent[600], fontSize: 12, marginTop: 6 },
  });
}
