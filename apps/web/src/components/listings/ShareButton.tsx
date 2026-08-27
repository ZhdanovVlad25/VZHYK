'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

/** Web Share API (мобільні браузери) з фолбеком на копіювання посилання (десктоп). */
export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // AbortError, коли юзер закрив системний шеринг-діалог — не помилка, нічого не робимо.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Немає ні Web Share, ні Clipboard API (дуже старий браузер) — тихо ігноруємо,
      // посилання й так видно в адресному рядку.
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleShare}>
      {copied ? 'Скопійовано' : 'Поділитися'}
    </Button>
  );
}
