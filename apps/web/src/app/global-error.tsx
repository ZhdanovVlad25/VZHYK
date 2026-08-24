'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Ловить помилки самого RootLayout (app/layout.tsx) — звичайний error.tsx їх не бачить,
 * бо сам є нащадком layout'а. Замінює весь <html>/<body>, тож не може покладатись на
 * ThemeProvider/LanguageProvider з layout.tsx (саме вони могли впасти).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="uk">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#0a0e14', color: '#f3f4f6' }}>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '1.5rem',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Щось пішло не так</h1>
          <p style={{ color: '#9ca3af', maxWidth: '28rem' }}>
            Сталася непередбачена помилка. Спробуйте оновити сторінку — якщо проблема триває,
            поверніться пізніше.
          </p>
          <a
            href="/"
            style={{
              borderRadius: '0.75rem',
              background: '#238a80',
              color: 'white',
              padding: '0.5rem 1.25rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            На головну
          </a>
        </div>
      </body>
    </html>
  );
}
