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

function ChatSidebar() {
  const pathname = usePathname();
  const { chats, isLoadingChats, chatsError, reloadChats, presence } = useChatContext();

  return (
    <aside className="w-full shrink-0 border-r border-gray-200 md:w-72">
      <h1 className="border-b border-gray-200 px-4 py-3 text-lg font-semibold text-gray-900">Повідомлення</h1>
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
                  className={cn('block border-b border-gray-100 px-4 py-3 hover:bg-gray-50', isActive && 'bg-brand-50')}
                >
                  <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <Avatar name={chat.otherDisplayName} size="sm" />
                      <span
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
                          isOnline ? 'bg-green-500' : 'bg-gray-300',
                        )}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-gray-900">{chat.otherDisplayName}</span>
                        {chat.unreadCount > 0 && <Badge tone="info">{chat.unreadCount}</Badge>}
                      </div>
                      {chat.listingTitle && <p className="truncate text-xs text-gray-500">{chat.listingTitle}</p>}
                      <p className="text-xs text-gray-400">{formatTime(chat.lastMessageAt)}</p>
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

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="mb-4 text-gray-600">Увійдіть, щоб побачити повідомлення.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  return (
    <ChatProvider>
      <div className="mx-auto flex h-full max-w-6xl flex-col border-x border-gray-200 md:flex-row">
        <ChatSidebar />
        <div className="min-h-0 min-w-0 flex-1">{children}</div>
      </div>
    </ChatProvider>
  );
}
