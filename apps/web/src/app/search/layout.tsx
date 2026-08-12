import type { Metadata } from 'next';

/**
 * search/page.tsx — client component ('use client', читає useSearchParams), тому не може
 * експортувати generateMetadata сам. Статичний title/description тут — найкраще, що можна
 * зробити без переписування сторінки на server-компонент.
 */
export const metadata: Metadata = {
  title: 'Пошук оголошень',
  description:
    'Знайдіть оголошення за назвою, категорією, ціною та іншими фільтрами на Вжик.',
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
