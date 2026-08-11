'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import { listChats, getPublicProfile, getListing, type ChatListItem } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
/** Gateway namespace живе поза глобальним REST-префіксом /api/v1 — див. chat.gateway.ts. */
const WS_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, '');

export interface EnrichedChat extends ChatListItem {
  otherDisplayName: string;
  listingTitle: string | null;
}

interface MessageNewPayload {
  chatId: string;
  senderId: string;
  createdAt: string;
}

interface ChatContextValue {
  socket: Socket | null;
  chats: EnrichedChat[];
  isLoadingChats: boolean;
  chatsError: string | null;
  reloadChats: () => void;
  presence: Record<string, 'online' | 'offline'>;
  markChatRead: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

async function enrichChats(items: ChatListItem[]): Promise<EnrichedChat[]> {
  const otherUserIds = [...new Set(items.map((c) => c.otherUserId).filter((id): id is string => Boolean(id)))];
  const listingIds = [...new Set(items.map((c) => c.listingId).filter((id): id is string => Boolean(id)))];

  const [profiles, listings] = await Promise.all([
    Promise.all(otherUserIds.map((id) => getPublicProfile(id).catch(() => null))),
    Promise.all(listingIds.map((id) => getListing(id).catch(() => null))),
  ]);

  const nameById = new Map(
    otherUserIds.map((id, i) => [id, profiles[i]?.displayName ?? profiles[i]?.username ?? `Користувач ${id.slice(0, 8)}`]),
  );
  const titleById = new Map(listingIds.map((id, i) => [id, listings[i]?.title ?? null]));

  return items.map((item) => ({
    ...item,
    otherDisplayName: item.otherUserId ? nameById.get(item.otherUserId) ?? 'Користувач' : 'Користувач',
    listingTitle: item.listingId ? titleById.get(item.listingId) ?? null : null,
  }));
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const pathname = usePathname();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chats, setChats] = useState<EnrichedChat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [presence, setPresence] = useState<Record<string, 'online' | 'offline'>>({});
  const reloadTokenRef = useRef(0);
  /** Мутація в тілі рендеру (не в ефекті) — потрібне найсвіжіше значення синхронно всередині WS-хендлера нижче, без перепідключення сокета при зміні маршруту. */
  const activeChatIdRef = useRef<string | null>(null);
  activeChatIdRef.current = pathname?.startsWith('/chats/') ? pathname.slice('/chats/'.length) : null;

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
        /** Чат, відкритий саме зараз, локально вважається прочитаним незалежно від
         * server-side unreadCount — сервер дізнається про це лише з наступного
         * GET /chats/:id/messages, який може ще не встигнути відпрацювати. */
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
  }, [socket, reloadChats]);

  const markChatRead = useCallback((chatId: string) => {
    setChats((prev) => prev.map((c) => (c.chatId === chatId ? { ...c, unreadCount: 0 } : c)));
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({ socket, chats, isLoadingChats, chatsError, reloadChats, presence, markChatRead }),
    [socket, chats, isLoadingChats, chatsError, reloadChats, presence, markChatRead],
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
