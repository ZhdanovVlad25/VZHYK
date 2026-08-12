import { test, expect } from '@playwright/test';
import { loginViaOtp, logout } from './helpers/auth';
import { uniquePhone } from './helpers/fixtures';

/**
 * docs/testing.md §3 сценарій 2 — Login (Phone OTP + Google OAuth). Google — лише
 * поверхнева перевірка redirect-ланцюжка (немає реальних GOOGLE_OAUTH_CLIENT_ID/_SECRET
 * в .env, той самий задокументований ліміт, що й у roadmap.md Google OAuth entry).
 */
test('існуючий юзер логіниться повторно через Phone OTP', async ({ page }) => {
  const phone = uniquePhone();

  await loginViaOtp(page, phone); // реєстрація
  await logout(page);
  await loginViaOtp(page, phone); // повторний логін тим самим номером

  await expect(page.getByRole('button', { name: 'Вийти' })).toBeVisible();
});

test('кнопка "Увійти через Google" веде на реальний Google consent screen', async ({ page }) => {
  await page.goto('/login');

  // Ловимо саме вихідний запит до Google з реальними query-параметрами — після нього
  // Google одразу редіректить на власну "Access blocked" сторінку (GOOGLE_OAUTH_CLIENT_ID
  // у .env — dev-заглушка, не зареєстрований клієнт, roadmap.md Google OAuth entry), тож
  // фінальний page.url() вже не несе цих параметрів.
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes('accounts.google.com') && req.url().includes('o/oauth2'), {
      timeout: 10_000,
    }),
    page.getByRole('button', { name: 'Увійти через Google' }).click(),
  ]);

  const url = new URL(request.url());
  expect(url.hostname).toBe('accounts.google.com');
  expect(url.searchParams.get('redirect_uri')).toContain('/auth/google/callback');
});
