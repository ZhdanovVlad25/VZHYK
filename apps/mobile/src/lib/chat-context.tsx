import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './auth-context';
import { listChats, getPublicProfile, getListing, getListingMedia, type ChatListItem } from './api';
import { notifyNewMessage } from './notifications';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
/** Gateway namespace живе поза глобальним REST-префіксом /api/v1 — див. chat.gateway.ts на бекенді. */
const WS_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

export interface EnrichedChat extends ChatListItem {
  otherDisplayName: string;
  listingTitle: string | null;
  listingPrice: number | null;
  listingCurrency: string | null;
  listingMainMediaUrl: string | null;
}

interface MessageNewPayload {
  chatId: string;
  senderId: string;
  createdAt: string;
  text: string;
}

interface ChatContextValue {
  socket: Socket | null;
  chats: EnrichedChat[];
  isLoadingChats: boolean;
  chatsError: string | null;
  reloadChats: () => void;
  presence: Record<string, 'online' | 'offline'>;
  markChatRead: (chatId: string) => void;
  /** Екран треду викликає при фокусі/розфокусі — заміна usePathname() з веб-версії, де активний чат читався з URL. */
  setActiveChatId: (chatId: string | null) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

async function enrichChats(items: ChatListItem[]): Promise<EnrichedChat[]> {
  const otherUserIds = [...new Set(items.map((c) => c.otherUserId).filter((id): id is string => Boolean(id)))];
  const listingIds = [...new Set(items.map((c) => c.listingId).filter((id): id is string => Boolean(id)))];

  const [profiles, listings, mediaByListing] = await Promise.all([
    Promise.all(otherUserIds.map((id) => getPublicProfile(id).catch(() => null))),
    Promise.all(listingIds.map((id) => getListing(id).catch(() => null))),
    Promise.all(listingIds.map((id) => getListingMedia(id).catch(() => []))),
  ]);

  const nameById = new Map(
    otherUserIds.map((id, i) => [id, profiles[i]?.displayName ?? profiles[i]?.username ?? `Користувач ${id.slice(0, 8)}`]),
  );
  const listingById = new Map(listingIds.map((id, i) => [id, listings[i]]));
  const mainMediaUrlById = new Map(
    listingIds.map((id, i) => {
      const media = mediaByListing[i];
      const main = media.find((m) => m.isMain) ?? media[0];
      return [id, main?.url ?? null];
    }),
  );

  return items.map((item) => {
    const listing = item.listingId ? listingById.get(item.listingId) : null;
    return {
      ...item,
      otherDisplayName: item.otherUserId ? nameById.get(item.otherUserId) ?? 'Користувач' : 'Користувач',
      listingTitle: listing?.title ?? null,
      listingPrice: listing?.price ?? null,
      listingCurrency: listing?.currency ?? null,
      listingMainMediaUrl: item.listingId ? mainMediaUrlById.get(item.listingId) ?? null : null,
    };
  });
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chats, setChats] = useState<EnrichedChat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, 'online' | 'offline'>>({});
  const reloadTokenRef = useRef(0);
  const activeChatIdRef = useRef<string | null>(null);

  const setActiveChatId = useCallback((chatId: string | null) => {
    activeChatIdRef.current = chatId;
  }, []);

  const reloadChats = useCallback(() => {
    reloadTokenRef.current += 1;
    const token = reloadTokenRef.current;
    if (!accessToken) return;
    setIsLoadingChats(true);
    setChatsError(null);
    listChats(accessToken)
      .then(enrichChats)
      .then((result) => {
        if (reloadTokenRef.current !== token) return;
        const withActiveRead = result.map((c) =>
          c.chatId === activeChatIdRef.current ? { ...c, unreadCount: 0 } : c,
        );
        setChats(withActiveRead);
      })
      .catch((err) => {
        if (reloadTokenRef.current === token) {
          setChatsError(err instanceof Error ? err.message : 'Не вдалося завантажити чати.');
        }
      })
      .finally(() => {
        if (reloadTokenRef.current === token) setIsLoadingChats(false);
      });
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      reloadChats();
    } else {
      setChats([]);
      setIsLoadingChats(false);
    }
  }, [accessToken, reloadChats]);

  useEffect(() => {
    if (!accessToken) {
      setSocket(null);
      return;
    }
    const instance = io(`${WS_ORIGIN}/ws/chat`, { auth: { token: accessToken }, transports: ['websocket'] });
    setSocket(instance);
    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, [accessToken]);

  useEffect(() => {
    if (!socket) return;

    function onMessageNew(payload: MessageNewPayload) {
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.chatId === payload.chatId);
        if (idx === -1) {
          reloadChats();
          return prev;
        }
        const isOpen = activeChatIdRef.current === payload.chatId;
        if (!isOpen && payload.senderId !== user?.id) {
          notifyNewMessage(prev[idx].otherDisplayName, payload.text);
        }
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          lastMessageAt: payload.createdAt,
          unreadCount: isOpen ? 0 : next[idx].unreadCount + 1,
        };
        next.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
        return next;
      });
    }

    function onPresence(payload: { userId: string; status: 'online' | 'offline' }) {
      setPresence((prev) => ({ ...prev, [payload.userId]: payload.status }));
    }

    socket.on('message:new', onMessageNew);
    socket.on('presence', onPresence);
    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('presence', onPresence);
    };
  }, [socket, reloadChats, user?.id]);

  const markChatRead = useCallback((chatId: string) => {
    setChats((prev) => prev.map((c) => (c.chatId === chatId ? { ...c, unreadCount: 0 } : c)));
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({ socket, chats, isLoadingChats, chatsError, reloadChats, presence, markChatRead, setActiveChatId }),
    [socket, chats, isLoadingChats, chatsError, reloadChats, presence, markChatRead, setActiveChatId],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatContext() має використовуватись всередині <ChatProvider>');
  }
  return ctx;
}
