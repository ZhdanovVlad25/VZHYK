/** @type {import('tailwindcss').Config} */
module.exports = {
  // 'class' а не 'media' — вибір теми має бути ручним перемикачем (ThemeProvider.tsx),
  // а не сліпо йти за system prefers-color-scheme без можливості юзера override.
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Кольори персонажа-маскота "Вжик": бірюзове тіло — основний бренд-колір,
        // червона футболка — акцент/CTA, жовта мордочка — highlight/бейджі.
        brand: {
          50: '#EAFBF9',
          100: '#CFF3EE',
          200: '#9FE3DB',
          // MUST-аудит "контраст чіпів у темній темі": не сам рушій хроми чіпів (той
          // окремо перевірений — 5.17-12.4:1, ОК), а ширший баг: dark:text-brand-400
          // використовується ~30 разів по всьому сайту (лого, лінки, ціни, кнопки), але
          // "400" узагалі не існував у палітрі — Tailwind просто не генерував це правило,
          // текст тихо лишався light-mode кольором brand-700 (#1B6D65) і на живому проді
          // давав 2.4-2.9:1 контрасту проти dark:bg-gray-800/900 (потрібно ≥4.5:1).
          400: '#5FC2B4',
          500: '#2FA89C',
          600: '#238A80',
          700: '#1B6D65',
          900: '#0F433E',
        },
        accent: {
          50: '#FDECEB',
          100: '#FAD1CE',
          500: '#E13B32',
          600: '#C22E26',
          700: '#9B241D',
        },
        highlight: {
          100: '#FCF0CC',
          400: '#F0C94A',
          500: '#DDAE1F',
          900: '#6B5200',
        },
        // Тепла нейтральна підложка для всієї сторінки (не стерильний білий) —
        // картки/шапка лишаються білими/tint зверху, тому потрібен контраст.
        page: '#FBF6EE',
      },
      fontFamily: {
        sans: ['var(--font-rubik)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-unbounded)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        // Лого-лоадер (Logo.tsx animated=true): очі періодично "закриваються" — scaleY
        // потребує transform-box:fill-box на елементі, інакше SVG масштабує від (0,0) viewport.
        'vzhyk-blink': {
          '0%, 90%, 100%': { transform: 'scaleY(1)' },
          '95%': { transform: 'scaleY(0.1)' },
        },
      },
      animation: {
        'vzhyk-blink': 'vzhyk-blink 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
