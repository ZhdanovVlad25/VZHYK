import { Logo } from '@/components/layout/Logo';

/** Next.js App Router route-level loading UI — показується під час навігації, поки серверний компонент нового сегмента вантажить дані (docs/design.md "Лого"). */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-24 text-gray-500">
      <Logo animated className="h-14 w-14" />
      <span>Завантаження…</span>
    </div>
  );
}
