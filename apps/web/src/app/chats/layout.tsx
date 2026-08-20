'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ChatProvider, useChatContext } from './chat-context';
import { Avatar, Badge, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { cn } from '@/lib/cn';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

function ChatSidebar({ hiddenOnMobile }: { hiddenOnMobile: boolean }) {
  const pathname = usePathname();
  const { chats, isLoadingChats, chatsError, reloadChats, presence } = useChatContext();

  return (
    <aside
      className={cn(
        'w-full shrink-0 border-r border-gray-200 dark:border-gray-700 md:block md:w-72',
        hiddenOnMobile && 'hidden',
      )}
    >
      <h1 className="border-b border-gray-200 px-4 py-3 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">Повідомлення</h1>
      {isLoadingChats ? (
        <LoadingState label="Завантаження чатів…" />
      ) : chatsError ? (
        <ErrorState description={chatsError} onRetry={reloadChats} />
      ) : chats.length === 0 ? (
        <EmptyState title="Чатів поки немає" description="Напишіть продавцю зі сторінки оголошення." />
      ) : (
        <ul className="flex flex-col">
          {chats.map((chat) => {
            const isActive = pathname === `/chats/${chat.chatId}`;
            const isOnline = chat.otherUserId ? presence[chat.otherUserId] === 'online' : false;
            return (
              <li key={chat.chatId}>
                <Link
                  href={`/chats/${chat.chatId}`}
                  className={cn(
                    'block border-b border-gray-100 px-4 py-3 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800',
                    isActive && 'bg-brand-50 dark:bg-gray-800',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <Avatar name={chat.otherDisplayName} size="sm" />
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-950',
                          isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600',
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium text-gray-900 dark:text-gray-100">{chat.otherDisplayName}</span>
                        {chat.unreadCount > 0 && <Badge tone="info">{chat.unreadCount}</Badge>}
                      </div>
                      {chat.listingTitle && <p className="truncate text-xs text-gray-500 dark:text-gray-400">{chat.listingTitle}</p>}
                      <p className="text-xs text-gray-400 dark:text-gray-500">{formatTime(chat.lastMessageAt)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export default function ChatsLayout({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const pathname = usePathname();
  // На <md показуємо або список чатів (на /chats), або відкритий тред — не обидва одразу.
  const isThreadOpen = pathname !== '/chats';

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-gray-400">Увійдіть, щоб побачити повідомлення.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  return (
    <ChatProvider>
      <div className="mx-auto w-full min-h-0 flex-1 max-w-6xl flex flex-col border-x border-gray-200 dark:border-gray-700 md:flex-row">
        <ChatSidebar hiddenOnMobile={isThreadOpen} />
        {/* flex flex-col тут навмисно (не лише flex-1) — дитина (ChatThreadPage) використовує
            свій власний flex-1/min-h-0 для розтягування на всю висоту; без display:flex тут
            той механізм не працює й composer "зависає" по центру замість дна екрана. */}
        <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !isThreadOpen && 'hidden md:flex')}>{children}</div>
      </div>
    </ChatProvider>
  );
}
