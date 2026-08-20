/**
 * Той самий бренд, що apps/web/tailwind.config.js — бірюзове тіло маскота (brand),
 * червоний светр (accent/CTA), жовта мордочка (highlight/бейджі). Ці відтінки не
 * змінюються між темами (бренд-кольори), лише поверхневі токени (page/white/text/border).
 */
const brand = {
  50: '#EAFBF9',
  100: '#CFF3EE',
  200: '#9FE3DB',
  500: '#2FA89C',
  600: '#238A80',
  700: '#1B6D65',
  900: '#0F433E',
};

const accent = {
  50: '#FDECEB',
  100: '#FAD1CE',
  500: '#E13B32',
  600: '#C22E26',
  700: '#9B241D',
};

const highlight = {
  100: '#FCF0CC',
  400: '#F0C94A',
  500: '#DDAE1F',
  900: '#6B5200',
};

export interface ColorScheme {
  brand: typeof brand;
  accent: typeof accent;
  highlight: typeof highlight;
  /** Тепла нейтральна підложка всього екрана. */
  page: string;
  /** Поверхня карток/полів поверх page — назва зберігається з першої (light-only) версії теми. */
  white: string;
  text: string;
  textMuted: string;
  border: string;
  /**
   * Завжди буквально білий — текст/іконка на суцільному brand-кольорі кнопки (chip active,
   * primary button) або на темному напівпрозорому оверлеї (галерея). НЕ те саме, що `white`
   * (поверхня картки), яка навмисно темніє в dark-темі — тут текст мусить лишатись білим
   * незалежно від теми, бо фон під ним завжди насичений brand/чорний, не поверхня сторінки.
   */
  buttonText: string;
}

export const lightColors: ColorScheme = {
  brand,
  accent,
  highlight,
  page: '#FBF6EE',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#6B6259',
  border: '#E5DFD3',
  buttonText: '#FFFFFF',
};

export const darkColors: ColorScheme = {
  brand,
  accent,
  highlight,
  page: '#121317',
  white: '#242A33',
  text: '#EDEFF3',
  textMuted: '#98A0AC',
  border: '#333A46',
  buttonText: '#FFFFFF',
};
