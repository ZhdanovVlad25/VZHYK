'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useChatContext } from '../chat-context';
import { ApiError, blockChat, getChatMessages, sendChatMessage, type Message } from '@/lib/api';
import { Badge, Button, ErrorState, LoadingState } from '@/components/ui';
import { cn } from '@/lib/cn';

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
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0">
          <Link href="/chats" className="mb-1 block text-xs text-gray-500 md:hidden">
            ← Усі чати
          </Link>
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', isOnline ? 'bg-green-500' : 'bg-gray-300')} aria-hidden="true" />
            <span className="truncate font-medium text-gray-900">{chat?.otherDisplayName ?? 'Чат'}</span>
          </div>
          {chat?.listingId && chat.listingTitle && (
            <Link href={`/listings/${chat.listingId}`} className="truncate text-xs text-brand-600 hover:underline">
              {chat.listingTitle}
            </Link>
          )}
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
          <Button size="sm" variant="ghost" onClick={() => setConfirmingBlock(true)}>
            Заблокувати
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
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
                  <li key={m.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                        isMine ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-900',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={cn('mt-1 text-right text-[10px]', isMine ? 'text-brand-100' : 'text-gray-400')}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {otherTyping && <p className="mt-2 text-xs text-gray-400">{chat?.otherDisplayName ?? 'Співрозмовник'} друкує…</p>}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <div className="border-t border-gray-200 p-3">
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
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none"
            />
            <Button type="submit" size="sm" isLoading={isSending} disabled={!text.trim()}>
              Надіслати
            </Button>
          </form>
        )}
        {sendError && <p className="mt-1 text-xs text-red-600">{sendError}</p>}
      </div>
    </div>
  );
}
