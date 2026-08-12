import { test, expect } from '@playwright/test';
import { loginViaOtp, loginAsPrivileged, logout } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/** docs/testing.md §3 сценарій 4 — модерація (авто-flag заборонених слів → ручний review). */
test('оголошення з забороненим словом потрапляє в чергу NEEDS_REVIEW', async ({ page }) => {
  const sellerPhone = uniquePhone();
  const title = uniqueTitle('Продам зброя мисливська');

  await loginViaOtp(page, sellerPhone);
  await page.goto('/listings/new');
  await page.getByRole('button', { name: 'Категорія' }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Назва').fill(title);
  await page.getByLabel('Ціна, грн').fill('1000');
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await page.waitForURL(/\/listings\/.+\/edit/);
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('PENDING_MODERATION')).toBeVisible();
  await logout(page);

  await loginAsPrivileged(page, uniquePhone(), 'moderator');
  await page.goto('/admin/moderation');
  await expect(page.getByText(title)).toBeVisible();
  const caseItem = page.locator('li', { hasText: title });
  await expect(caseItem.getByText('Потребує уваги')).toBeVisible();
  await expect(caseItem.getByText(/Авто-флаг: BANNED_WORD/)).toBeVisible();
});
