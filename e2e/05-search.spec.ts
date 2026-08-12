import { test, expect } from '@playwright/test';
import { loginAsPrivileged, loginViaOtp, logout } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/** docs/testing.md §3 сценарій 5 — пошук з фільтрами та сортуванням. */
test('опубліковане й схвалене оголошення знаходиться за назвою в пошуку', async ({ page }) => {
  const sellerPhone = uniquePhone();
  const title = uniqueTitle('Велосипед гірський Trek');

  await loginViaOtp(page, sellerPhone);
  await page.goto('/listings/new');
  await page.getByRole('button', { name: 'Категорія' }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Назва').fill(title);
  await page.getByLabel('Ціна, грн').fill('5000');
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await page.waitForURL(/\/listings\/.+\/edit/);
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await logout(page);

  await loginAsPrivileged(page, uniquePhone(), 'moderator');
  await page.goto('/admin/moderation');
  const caseItem = page.locator('li', { hasText: title });
  await caseItem.getByRole('button', { name: 'Схвалити' }).click();
  await expect(caseItem.getByText('Схвалено')).toBeVisible();
  await logout(page);

  await page.goto(`/search?q=${encodeURIComponent(title)}`);
  // "Результати пошуку: «title»" у h1 теж містить текст запиту — скоупимось на ListingCard-лінк.
  await expect(page.getByRole('link').filter({ hasText: title })).toBeVisible();
});
