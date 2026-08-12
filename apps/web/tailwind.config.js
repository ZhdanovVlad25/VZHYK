/** @type {import('tailwindcss').Config} */
module.exports = {
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
    },
  },
  plugins: [],
};
