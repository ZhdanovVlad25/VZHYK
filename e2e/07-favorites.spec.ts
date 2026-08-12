import { test, expect } from '@playwright/test';
import { loginAsPrivileged, loginViaOtp, logout } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/** docs/testing.md §3 сценарій 7 — favorite (додати/видалити). */
test('додає оголошення в обране і прибирає', async ({ page }) => {
  const title = uniqueTitle('Куртка зимова чоловіча');

  await loginViaOtp(page, uniquePhone());
  await page.goto('/listings/new');
  await page.getByRole('button', { name: 'Категорія' }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Назва').fill(title);
  await page.getByLabel('Ціна, грн').fill('1800');
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await page.waitForURL(/\/listings\/(.+)\/edit/);
  const listingId = page.url().match(/\/listings\/([^/]+)\/edit/)?.[1];
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await logout(page);

  await loginAsPrivileged(page, uniquePhone(), 'moderator');
  await page.goto('/admin/moderation');
  await page.locator('li', { hasText: title }).getByRole('button', { name: 'Схвалити' }).click();
  await logout(page);

  await loginViaOtp(page, uniquePhone());
  await page.goto(`/listings/${listingId}`);
  await page.getByRole('button', { name: 'В обране' }).click();
  await expect(page.getByRole('button', { name: 'В обраному' })).toBeVisible();

  await page.goto('/favorites');
  await expect(page.getByText(title)).toBeVisible();

  await page.getByRole('button', { name: 'Прибрати' }).click();
  await expect(page.getByText(title)).not.toBeVisible();
});
