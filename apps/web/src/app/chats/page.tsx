import { EmptyState } from '@/components/ui';

export default function ChatsIndexPage() {
  return (
    <div className="hidden flex-1 items-center justify-center md:flex">
      <EmptyState title="Оберіть чат" description="Виберіть розмову зі списку зліва, щоб побачити повідомлення." />
    </div>
  );
}
