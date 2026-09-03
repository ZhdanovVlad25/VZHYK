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
            width: 220,
            height: 220,
            borderRadius: 44,
            border: '6px solid rgba(255,255,255,0.25)',
            display: 'flex',
            marginBottom: 32,
          }}
        >
          <svg width="220" height="220" viewBox="0 0 200 200">
            <rect x="0" y="0" width="200" height="200" rx="40" fill="#238A80" />
            <rect x="25" y="45" width="70" height="70" rx="16" fill="#F0C94A" />
            <rect x="105" y="45" width="70" height="70" rx="16" fill="#F0C94A" />
            <circle cx="65" cy="90" r="14" fill="#1A1A1A" />
            <circle cx="61" cy="86" r="3" fill="#FFFFFF" />
            <circle cx="135" cy="90" r="14" fill="#1A1A1A" />
            <circle cx="131" cy="86" r="3" fill="#FFFFFF" />
            <ellipse cx="100" cy="140" rx="16" ry="10" fill="#1A1A1A" />
            <circle cx="94" cy="136" r="3" fill="#FFFFFF" />
            <rect x="0" y="170" width="200" height="14" fill="#E13B32" />
            <rect x="0" y="184" width="200" height="16" fill="#9B241D" />
          </svg>
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
