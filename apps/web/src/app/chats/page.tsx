import { EmptyState } from '@/components/ui';

export default function ChatsIndexPage() {
  return (
    <div className="hidden h-full items-center justify-center md:flex">
      <EmptyState title="Оберіть чат" description="Виберіть розмову зі списку зліва, щоб побачити повідомлення." />
    </div>
  );
}
