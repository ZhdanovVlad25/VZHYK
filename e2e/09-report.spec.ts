import { test, expect } from '@playwright/test';
import { loginAsPrivileged, loginViaOtp, logout } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/** docs/testing.md §3 сценарій 9 — скарга (створення + обробка модератором). */
test('скарга на оголошення створюється і обробляється модератором', async ({ page }) => {
  const title = uniqueTitle('Годинник Casio оригінал');

  await loginViaOtp(page, uniquePhone());
  await page.goto('/listings/new');
  await page.getByRole('button', { name: 'Категорія' }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Назва').fill(title);
  await page.getByLabel('Ціна, грн').fill('900');
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await page.waitForURL(/\/listings\/(.+)\/edit/);
  const listingId = page.url().match(/\/listings\/([^/]+)\/edit/)?.[1];
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await logout(page);

  await loginAsPrivileged(page, uniquePhone(), 'moderator');
  await page.goto('/admin/moderation');
  await page.locator('li', { hasText: title }).getByRole('button', { name: 'Схвалити' }).click();
  await logout(page);

  // Скарга від третьої людини (не власника, не модератора).
  await loginViaOtp(page, uniquePhone());
  await page.goto(`/listings/${listingId}`);
  await page.getByRole('button', { name: 'Поскаржитися' }).click();
  await page.getByRole('button', { name: 'Причина скарги' }).click();
  await page.getByRole('option', { name: 'Шахрайство' }).click();
  await page.getByRole('button', { name: 'Надіслати' }).click();
  await expect(page.getByText('Скаргу надіслано, дякуємо')).toBeVisible();
  await logout(page);

  // /admin/reports не фільтрує за замовчуванням — з попередніх e2e-прогонів накопичуються
  // інші скарги, тож скоупимось саме на картку зі своїм listingId, а не на текст причини.
  await loginAsPrivileged(page, uniquePhone(), 'moderator');
  await page.goto('/admin/reports');
  const reportItem = page.locator('li').filter({ has: page.locator(`a[href="/listings/${listingId}"]`) });
  await expect(reportItem).toBeVisible();
  await reportItem.getByRole('button', { name: 'Вирішено' }).click();
  await expect(reportItem.getByText('Вирішено')).toBeVisible();
});
