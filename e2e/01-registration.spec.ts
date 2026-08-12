import { test, expect } from '@playwright/test';
import { loginViaOtp } from './helpers/auth';
import { uniquePhone } from './helpers/fixtures';

/** docs/testing.md §3 сценарій 1 — реєстрація через Phone OTP. */
test('нова людина реєструється через Phone OTP', async ({ page }) => {
  const phone = uniquePhone();

  await loginViaOtp(page, phone);

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Вийти' })).toBeVisible();
  await expect(page.getByText(phone)).toBeVisible();
});
