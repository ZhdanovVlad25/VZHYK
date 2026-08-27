'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useChatContext } from '../chat-context';
import { ApiError, blockChat, getChatMessages, sendChatMessage, type Message } from '@/lib/api';
import { Avatar, Badge, Button, ErrorState, LoadingState } from '@/components/ui';
import { ReportButton } from '@/components/shared/ReportButton';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';

const TYPING_TIMEOUT_MS = 3000;

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export default function ChatThreadPage({ params }: { params: { id: string } }) {
  const chatId = params.id;
  const { user, accessToken } = useAuth();
  const { socket, chats, presence, markChatRead } = useChatContext();

  const chat = chats.find((c) => c.chatId === chatId);
  const isOnline = chat?.otherUserId ? presence[chat.otherUserId] === 'online' : false;

  const [messages, setMessages] = useState<Message[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markChatRead стабільна для цього рендеру, не мета залежності перезавантаження
  }, [chatId, accessToken]);

  useEffect(() => {
    setMessages([]);
    setSendError(null);
    setIsBlocked(false);
    load();
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
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

  async function handleBlock() {
    if (!accessToken) return;
    await blockChat(chatId, accessToken);
    setConfirmingBlock(false);
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="min-w-0">
          <Link href="/chats" className="mb-1 block text-xs text-gray-500 dark:text-gray-400 md:hidden">
            ← Усі чати
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative shrink-0">
              <Avatar name={chat?.otherDisplayName ?? null} size="sm" />
              <span
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-950',
                  isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
                )}
                aria-hidden="true"
              />
            </div>
            {/* min-w-0 обов'язковий разом з truncate — інакше flex-item за замовчуванням
                (min-width:auto) відмовляється стискатись нижче повної ширини тексту,
                truncate фактично ніколи не спрацьовує. */}
            <span className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">{chat?.otherDisplayName ?? 'Чат'}</span>
          </div>
        </div>
        {confirmingBlock ? (
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="danger" onClick={handleBlock}>
              Підтвердити
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingBlock(false)}>
              Скасувати
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-start gap-2">
            <ReportButton targetType="CHAT" targetId={chatId} />
            <Button size="sm" variant="ghost" onClick={() => setConfirmingBlock(true)}>
              Заблокувати
            </Button>
          </div>
        )}
      </div>

      {chat?.listingId && chat.listingTitle && (
        <Link
          href={`/listings/${chat.listingId}`}
          className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
        >
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-700">
            {chat.listingMainMediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL
              <img src={chat.listingMainMediaUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{chat.listingTitle}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatPrice(chat.listingPrice, chat.listingCurrency ?? 'UAH')}
            </p>
          </div>
        </Link>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <LoadingState label="Завантаження повідомлень…" />
        ) : loadError ? (
          <ErrorState description={loadError} onRetry={load} />
        ) : (
          <>
            {nextCursor && (
              <div className="mb-3 flex justify-center">
                <Button size="sm" variant="secondary" isLoading={isLoadingOlder} onClick={loadOlder}>
                  Завантажити старіші
                </Button>
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {messages.map((m) => {
                const isMine = m.senderId === user?.id;
                return (
                  <li key={m.id} className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                        isMine ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={cn('mt-1 text-right text-[10px]', isMine ? 'text-brand-100' : 'text-gray-400 dark:text-gray-500')}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                    {/* Антифрод: шахраї часто виводять розмову з платформи в Telegram/Viber, де
                        немає ні модерації, ні історії листування — попереджаємо обидві сторони,
                        не блокуючи повідомлення (легітимні причини теж трапляються). */}
                    {m.containsExternalContact && (
                      <p className="mt-1 max-w-[75%] text-[11px] text-amber-600 dark:text-amber-500">
                        ⚠️ Згадка іншого месенджера — спілкування поза платформою підвищує ризик шахрайства.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {otherTyping && <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{chat?.otherDisplayName ?? 'Співрозмовник'} друкує…</p>}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        {isBlocked ? (
          <Badge tone="danger">Ви заблоковані в цьому чаті — надсилання недоступне</Badge>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2">
            <label htmlFor="chat-message" className="sr-only">
              Повідомлення
            </label>
            <input
              id="chat-message"
              value={text}
              onChange={(e) => handleTypingInput(e.target.value)}
              placeholder="Напишіть повідомлення…"
              maxLength={2000}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <Button type="submit" size="sm" isLoading={isSending} disabled={!text.trim()}>
              Надіслати
            </Button>
          </form>
        )}
        {sendError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{sendError}</p>}
      </div>
    </div>
  );
}
