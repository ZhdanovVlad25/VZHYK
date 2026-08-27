import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Спеціальний файл Next.js (next/og) — авто-роут /opengraph-image, підхоплюється як
 * дефолтний og:image для всього сайту (сторінки з власним generateMetadata, напр.
 * listings/[id], перевизначають своєю картинкою фото товару). Аудит 27.08: без цього
 * посилання на сайт у месенджерах показувало порожній прямокутник.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#238A80',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            width: 180,
            height: 180,
            borderRadius: 36,
            background: '#238A80',
            border: '6px solid rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F0C94A' }} />
            <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F0C94A' }} />
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 96, fontWeight: 800, color: '#fff' }}>Вжик</div>
        <div style={{ display: 'flex', fontSize: 34, color: 'rgba(255,255,255,0.9)', marginTop: 12 }}>
          Оголошення по всій Україні
        </div>
      </div>
    ),
    { ...size },
  );
}
