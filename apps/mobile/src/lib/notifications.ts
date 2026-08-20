import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Показує сповіщення, поки застосунок відкритий (foreground) — так само, як banner на інших
 * платформах. Бекенд не зберігає Expo push token і не шле push через Expo Push API, тож це
 * лише локальне сповіщення, що триґериться живою socket.io-подією: працює, поки процес
 * застосунку живий (foreground/backgrounded), але НЕ коли застосунок вбитий чи офлайн —
 * для цього потрібен окремий бекенд-ендпоінт (зберігати токен + слати через Expo Push API).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

let permissionRequested = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionRequested) {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  }
  permissionRequested = true;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Повідомлення',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function notifyNewMessage(title: string, body: string): Promise<void> {
  const granted = await ensureNotificationPermission().catch(() => false);
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  }).catch(() => {});
}
