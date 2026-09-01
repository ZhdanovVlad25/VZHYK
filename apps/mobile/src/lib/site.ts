/**
 * Публічний веб-домен — для лінків на правові сторінки (rules/oferta/privacy), яких на
 * мобільному немає власних екранів (RN-порт apps/web/src/lib/site.ts). Відкриваються через
 * Linking.openURL у системному браузері — react-native-webview не підключений, і для
 * статичного тексту повноцінний in-app WebView не вартий нового нативного модуля.
 */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://web-production-baba8.up.railway.app').replace(/\/$/, '');
