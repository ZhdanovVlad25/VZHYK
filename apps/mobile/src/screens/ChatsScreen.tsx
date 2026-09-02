import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../lib/auth-context';
import { useChatContext, type EnrichedChat } from '../lib/chat-context';
import { useLanguage } from '../lib/language-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { Avatar } from '../components/Avatar';
import { LoadingScreen } from '../components/LoadingScreen';
import type { AppNavigation } from '../navigation/types';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

/** Список чатів — RN-порт ChatSidebar з apps/web/src/app/chats/layout.tsx. */
export function ChatsScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const { user, isLoading: authLoading } = useAuth();
  const { chats, isLoadingChats, chatsError, reloadChats, presence } = useChatContext();
  const [tab, setTab] = useState<'selling' | 'buying'>('selling');

  // "Продаю" — я власник оголошення в чаті; "Купую" — все інше (чужі оголошення, чати без оголошення).
  const sellingChats = useMemo(() => chats.filter((c) => c.listingUserId === user?.id), [chats, user?.id]);
  const buyingChats = useMemo(() => chats.filter((c) => c.listingUserId !== user?.id), [chats, user?.id]);
  const visibleChats = tab === 'selling' ? sellingChats : buyingChats;
  const sellingUnread = useMemo(() => sellingChats.reduce((sum, c) => sum + c.unreadCount, 0), [sellingChats]);
  const buyingUnread = useMemo(() => buyingChats.reduce((sum, c) => sum + c.unreadCount, 0), [buyingChats]);

  if (!authLoading && !user) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerText}>Увійдіть, щоб побачити повідомлення.</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.primaryButtonText}>{t('login')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <FlatList
        data={visibleChats}
        keyExtractor={(c) => c.chatId}
        renderItem={({ item }) => {
          const isOnline = item.otherUserId ? presence[item.otherUserId] === 'online' : false;
          return (
            <Pressable style={styles.row} onPress={() => navigation.navigate('ChatThread', { chatId: item.chatId })}>
              <View style={styles.avatarWrap}>
                <Avatar size="sm" />
                <View style={[styles.presenceDot, isOnline ? styles.presenceOnline : styles.presenceOffline]} />
              </View>
              <View style={styles.rowInfo}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.otherDisplayName}
                  </Text>
                  {item.unreadCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
                {item.listingTitle && (
                  <Text style={styles.rowListing} numberOfLines={1}>
                    {item.listingTitle}
                  </Text>
                )}
                {item.lastMessageText && (
                  <Text
                    style={[styles.rowMessage, item.unreadCount > 0 && styles.rowMessageUnread]}
                    numberOfLines={1}
                  >
                    {item.lastMessageText}
                  </Text>
                )}
                <Text style={styles.rowTime}>{formatTime(item.lastMessageAt)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>{t('messages')}</Text>
            <View style={styles.tabRow}>
              <Pressable style={[styles.tab, tab === 'selling' && styles.tabActive]} onPress={() => setTab('selling')}>
                <Text style={[styles.tabText, tab === 'selling' && styles.tabTextActive]}>Продаю</Text>
                {sellingUnread > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{sellingUnread}</Text>
                  </View>
                )}
              </Pressable>
              <Pressable style={[styles.tab, tab === 'buying' && styles.tabActive]} onPress={() => setTab('buying')}>
                <Text style={[styles.tabText, tab === 'buying' && styles.tabTextActive]}>Купую</Text>
                {buyingUnread > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{buyingUnread}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </>
        }
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoadingChats && chats.length > 0} onRefresh={reloadChats} tintColor={colors.brand[600]} />}
        ListEmptyComponent={
          isLoadingChats ? (
            <LoadingScreen />
          ) : chatsError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{chatsError}</Text>
              <Pressable style={styles.retryButton} onPress={reloadChats}>
                <Text style={styles.retryButtonText}>Спробувати ще раз</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {tab === 'selling'
                ? 'Тут з’являться чати щодо ваших оголошень.'
                : 'Чатів поки немає. Напишіть продавцю зі сторінки оголошення.'}
            </Text>
          )
        }
      />
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerText: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  listContent: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 12 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.brand[100], borderColor: colors.brand[200] },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.brand[700] },
  tabBadge: { backgroundColor: colors.brand[600], borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { color: colors.buttonText, fontSize: 11, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  avatarWrap: { position: 'relative' },
  presenceDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.white,
  },
  presenceOnline: { backgroundColor: '#22c55e' },
  presenceOffline: { backgroundColor: colors.border },
  rowInfo: { flex: 1, minWidth: 0, gap: 2 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text, flexShrink: 1 },
  unreadBadge: { backgroundColor: colors.brand[600], borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  unreadBadgeText: { color: colors.buttonText, fontSize: 11, fontWeight: '700' },
  rowListing: { fontSize: 12, color: colors.brand[700] },
  rowMessage: { fontSize: 13, color: colors.textMuted },
  rowMessageUnread: { color: colors.text, fontWeight: '600' },
  rowTime: { fontSize: 11, color: colors.textMuted },
  primaryButton: { backgroundColor: colors.accent[600], borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  primaryButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 15 },
  errorBox: { alignItems: 'center', gap: 10, marginTop: 24 },
  errorText: { color: colors.accent[600], textAlign: 'center' },
  retryButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryButtonText: { color: colors.buttonText, fontWeight: '600' },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  });
}
