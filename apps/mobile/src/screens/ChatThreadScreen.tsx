import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiError, Message, blockChat, getChatMessages, sendChatMessage } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useChatContext } from '../lib/chat-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { formatPrice } from '../lib/format';
import { LoadingScreen } from '../components/LoadingScreen';
import type { RootStackParamList } from '../navigation/types';

const TYPING_TIMEOUT_MS = 3000;

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Тред чату — RN-порт apps/web/src/app/chats/[id]/page.tsx. */
export function ChatThreadScreen({ route, navigation }: Props) {
  const { chatId } = route.params;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const { user, accessToken } = useAuth();
  const { socket, chats, markChatRead, setActiveChatId } = useChatContext();

  const chat = chats.find((c) => c.chatId === chatId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);
  const listRef = useRef<FlatList<Message>>(null);

  useFocusEffect(
    useCallback(() => {
      setActiveChatId(chatId);
      return () => setActiveChatId(null);
    }, [chatId, setActiveChatId]),
  );

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const page = await getChatMessages(chatId, accessToken);
      setMessages([...page.items].reverse());
      setNextCursor(page.nextCursor);
      markChatRead(chatId);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Не вдалося завантажити повідомлення.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markChatRead стабільна для цього рендеру
  }, [chatId, accessToken]);

  useEffect(() => {
    setMessages([]);
    setSendError(null);
    setIsBlocked(false);
    load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', { chatId });

    function onMessageNew(payload: Message) {
      if (payload.chatId !== chatId) return;
      setMessages((prev) => (prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]));
      markChatRead(chatId);
    }

    function onTyping(payload: { chatId: string; userId: string }) {
      if (payload.chatId !== chatId || payload.userId === user?.id) return;
      setOtherTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS);
    }

    socket.on('message:new', onMessageNew);
    socket.on('chat:typing', onTyping);
    return () => {
      socket.emit('chat:leave', { chatId });
      socket.off('message:new', onMessageNew);
      socket.off('chat:typing', onTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markChatRead стабільна для цього рендеру
  }, [socket, chatId, user?.id]);

  async function loadOlder() {
    if (!nextCursor || !accessToken) return;
    setIsLoadingOlder(true);
    try {
      const page = await getChatMessages(chatId, accessToken, nextCursor);
      setMessages((prev) => [...[...page.items].reverse(), ...prev]);
      setNextCursor(page.nextCursor);
    } finally {
      setIsLoadingOlder(false);
    }
  }

  function handleTypingInput(value: string) {
    setText(value);
    if (!socket) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > 1500) {
      socket.emit('chat:typing', { chatId });
      lastTypingEmitRef.current = now;
    }
  }

  async function handleSend() {
    if (!accessToken || !text.trim()) return;
    setIsSending(true);
    setSendError(null);
    try {
      const message = await sendChatMessage(chatId, text.trim(), accessToken);
      setMessages((prev) => [...prev, message]);
      setText('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CHAT_BLOCKED') {
        setIsBlocked(true);
      } else {
        setSendError(err instanceof ApiError ? err.message : 'Не вдалося надіслати повідомлення.');
      }
    } finally {
      setIsSending(false);
    }
  }

  function confirmBlock() {
    Alert.alert('Заблокувати чат?', undefined, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Заблокувати', style: 'destructive', onPress: handleBlock },
    ]);
  }

  async function handleBlock() {
    if (!accessToken) return;
    await blockChat(chatId, accessToken);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerName} numberOfLines={1}>
          {chat?.otherDisplayName ?? 'Чат'}
        </Text>
        <Pressable onPress={confirmBlock}>
          <Text style={styles.blockText}>Заблокувати</Text>
        </Pressable>
      </View>
      {chat?.listingId && chat.listingTitle && (
        <Pressable
          style={styles.listingCard}
          onPress={() => navigation.navigate('ListingDetail', { listingId: chat.listingId! })}
        >
          <View style={styles.listingImageWrap}>
            {chat.listingMainMediaUrl && (
              <Image source={{ uri: chat.listingMainMediaUrl }} style={styles.listingImage} resizeMode="cover" />
            )}
          </View>
          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {chat.listingTitle}
            </Text>
            <Text style={styles.listingPrice}>{formatPrice(chat.listingPrice, chat.listingCurrency ?? 'UAH')}</Text>
          </View>
        </Pressable>
      )}

      {isLoading ? (
        <LoadingScreen />
      ) : loadError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Спробувати ще раз</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={
            nextCursor ? (
              <Pressable style={styles.loadOlderButton} onPress={loadOlder} disabled={isLoadingOlder}>
                {isLoadingOlder ? (
                  <ActivityIndicator color={colors.accent[700]} size="small" />
                ) : (
                  <Text style={styles.loadOlderText}>Завантажити старіші</Text>
                )}
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const isMine = item.senderId === user?.id;
            return (
              <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text>
                  <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={otherTyping ? <Text style={styles.typingText}>{chat?.otherDisplayName ?? 'Співрозмовник'} друкує…</Text> : null}
        />
      )}

      <View style={[styles.composer, { paddingBottom: 12 + insets.bottom }]}>
        {isBlocked ? (
          <View style={styles.blockedBadge}>
            <Text style={styles.blockedBadgeText}>Ви заблоковані в цьому чаті — надсилання недоступне</Text>
          </View>
        ) : (
          <View style={styles.composerRow}>
            <TextInput
              value={text}
              onChangeText={handleTypingInput}
              placeholder="Напишіть повідомлення…"
              placeholderTextColor={colors.textMuted}
              maxLength={2000}
              style={styles.composerInput}
              onSubmitEditing={handleSend}
            />
            <Pressable style={[styles.sendButton, !text.trim() && styles.sendButtonDisabled]} onPress={handleSend} disabled={!text.trim() || isSending}>
              {isSending ? <ActivityIndicator color={colors.buttonText} size="small" /> : <Text style={styles.sendButtonText}>Надіслати</Text>}
            </Pressable>
          </View>
        )}
        {sendError && <Text style={styles.sendErrorText}>{sendError}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.page },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.text, flexShrink: 1 },
  blockText: { color: colors.accent[600], fontSize: 13, fontWeight: '500' },
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listingImageWrap: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.page },
  listingImage: { width: '100%', height: '100%' },
  listingInfo: { flex: 1, minWidth: 0, gap: 2 },
  listingTitle: { color: colors.text, fontSize: 13, fontWeight: '500' },
  listingPrice: { color: colors.textMuted, fontSize: 12 },
  messagesContent: { padding: 16, gap: 8 },
  loadOlderButton: { alignSelf: 'center', backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 8 },
  loadOlderText: { color: colors.accent[700], fontWeight: '600', fontSize: 13 },
  messageRow: { flexDirection: 'row', marginBottom: 4 },
  messageRowMine: { justifyContent: 'flex-end' },
  messageRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { backgroundColor: colors.brand[600] },
  bubbleTheirs: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  bubbleTextMine: { color: colors.buttonText, fontSize: 14 },
  bubbleTextTheirs: { color: colors.text, fontSize: 14 },
  bubbleTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  bubbleTimeMine: { color: colors.brand[100] },
  bubbleTimeTheirs: { color: colors.textMuted },
  typingText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  errorBox: { alignItems: 'center', gap: 10, marginTop: 24 },
  errorText: { color: colors.accent[600], textAlign: 'center' },
  retryButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryButtonText: { color: colors.buttonText, fontWeight: '600' },
  composer: { borderTopWidth: 1, borderTopColor: colors.border, padding: 12 },
  composerRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  composerInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  sendButton: { backgroundColor: colors.accent[600], borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 13 },
  sendErrorText: { color: colors.accent[600], fontSize: 12, marginTop: 6 },
  blockedBadge: { backgroundColor: colors.accent[50], borderRadius: 10, padding: 10 },
  blockedBadgeText: { color: colors.accent[600], fontSize: 13 },
  });
}
