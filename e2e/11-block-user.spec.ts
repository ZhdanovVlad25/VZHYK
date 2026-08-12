import { test, expect } from '@playwright/test';
import { loginAsPrivileged, loginViaOtp, logout } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/**
 * docs/testing.md §3 сценарій 11 — блокування юзера адміном → усі активні оголошення
 * переходять у BLOCKED (docs/moderation.md §7, Part A2 fix цієї сесії).
 */
test('блокування юзера адміном переводить його ACTIVE оголошення в BLOCKED', async ({ page }) => {
  const sellerPhone = uniquePhone();
  const title = uniqueTitle('Товар під адмінське блокування');

  await loginViaOtp(page, sellerPhone);
  await page.goto('/listings/new');
  await page.getByRole('button', { name: 'Категорія' }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Назва').fill(title);
  await page.getByLabel('Ціна, грн').fill('500');
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await page.waitForURL(/\/listings\/.+\/edit/);
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await logout(page);

  await loginAsPrivileged(page, uniquePhone(), 'moderator');
  await page.goto('/admin/moderation');
  await page.locator('li', { hasText: title }).getByRole('button', { name: 'Схвалити' }).click();
  await logout(page);

  await loginAsPrivileged(page, uniquePhone(), 'admin');
  await page.goto('/admin/users');
  // "Знайти" є і в глобальному пошуку в Header, і у формі сторінки — скоупимось на #main-content.
  const usersMain = page.locator('#main-content');
  await usersMain.getByLabel('Пошук за телефоном або email').fill(sellerPhone);
  await usersMain.getByRole('button', { name: 'Знайти' }).click();
  await usersMain.getByRole('button', { name: 'Заблокувати' }).click();
  await expect(usersMain.getByRole('button', { name: 'Розблокувати' })).toBeVisible();

  await page.goto('/admin/listings');
  const listingsMain = page.locator('#main-content');
  await listingsMain.getByLabel('Пошук за назвою').fill(title);
  await listingsMain.getByRole('button', { name: 'Знайти' }).click();
  await expect(listingsMain.getByText('Заблоковано')).toBeVisible();
});
