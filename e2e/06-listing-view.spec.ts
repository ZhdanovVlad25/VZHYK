import { test, expect } from '@playwright/test';
import { loginAsPrivileged, loginViaOtp, logout } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/** docs/testing.md §3 сценарій 6 — перегляд оголошення + збільшення views_count (лише для НЕ-власника). */
test('перегляд ACTIVE оголошення НЕ-власником збільшує views_count', async ({ page }) => {
  const title = uniqueTitle('iPhone 13 Pro 128GB');

  await loginViaOtp(page, uniquePhone());
  await page.goto('/listings/new');
  await page.getByRole('button', { name: 'Категорія' }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Назва').fill(title);
  await page.getByLabel('Ціна, грн').fill('23000');
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await page.waitForURL(/\/listings\/(.+)\/edit/);
  const listingId = page.url().match(/\/listings\/([^/]+)\/edit/)?.[1];
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await logout(page);

  await loginAsPrivileged(page, uniquePhone(), 'moderator');
  await page.goto('/admin/moderation');
  await page.locator('li', { hasText: title }).getByRole('button', { name: 'Схвалити' }).click();
  await logout(page);

  // Другий (не-власник) юзер переглядає оголошення двічі — views_count рахує лише чужі перегляди.
  await loginViaOtp(page, uniquePhone());
  await page.goto(`/listings/${listingId}`);
  const before = await page.getByText(/переглядів/).textContent();

  await page.reload();
  const after = await page.getByText(/переглядів/).textContent();

  const beforeCount = parseInt(before ?? '0', 10);
  const afterCount = parseInt(after ?? '0', 10);
  expect(afterCount).toBeGreaterThan(beforeCount);
});
