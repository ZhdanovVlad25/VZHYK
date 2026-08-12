import { test, expect } from '@playwright/test';
import { loginAsPrivileged, loginViaOtp } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/**
 * docs/testing.md §3 сценарій 8 — chat (створення, повідомлення, unread). Три окремі
 * browser context'и (продавець/модератор/покупець) — кожен тримає свою сесію одночасно,
 * на відміну від інших сценаріїв, де один page логінився послідовно під різними ролями.
 */
test('покупець пише продавцю, повідомлення й unread з’являються з обох боків', async ({ browser }) => {
  const sellerCtx = await browser.newContext();
  const moderatorCtx = await browser.newContext();
  const buyerCtx = await browser.newContext();
  const sellerPage = await sellerCtx.newPage();
  const moderatorPage = await moderatorCtx.newPage();
  const buyerPage = await buyerCtx.newPage();

  const title = uniqueTitle('Диван кутовий б/в');

  await loginViaOtp(sellerPage, uniquePhone());
  await sellerPage.goto('/listings/new');
  await sellerPage.getByRole('button', { name: 'Категорія' }).click();
  await sellerPage.getByRole('option').first().click();
  await sellerPage.getByLabel('Назва').fill(title);
  await sellerPage.getByLabel('Ціна, грн').fill('3000');
  await sellerPage.getByRole('button', { name: 'Створити чернетку' }).click();
  await sellerPage.waitForURL(/\/listings\/(.+)\/edit/);
  const listingId = sellerPage.url().match(/\/listings\/([^/]+)\/edit/)?.[1];
  await sellerPage.getByRole('button', { name: 'Опублікувати' }).click();

  await loginAsPrivileged(moderatorPage, uniquePhone(), 'moderator');
  await moderatorPage.goto('/admin/moderation');
  await moderatorPage.locator('li', { hasText: title }).getByRole('button', { name: 'Схвалити' }).click();

  await loginViaOtp(buyerPage, uniquePhone());
  await buyerPage.goto(`/listings/${listingId}`);
  await buyerPage.getByRole('button', { name: 'Написати продавцю' }).click();
  await buyerPage.waitForURL(/\/chats\/.+/);

  await buyerPage.getByLabel('Повідомлення').fill('Ще актуально?');
  await buyerPage.getByRole('button', { name: 'Надіслати' }).click();
  await expect(buyerPage.getByText('Ще актуально?')).toBeVisible();

  await sellerPage.goto('/chats');
  await expect(sellerPage.getByText(title)).toBeVisible();
  await sellerPage.getByText(title).click();
  await expect(sellerPage.getByText('Ще актуально?')).toBeVisible();

  await sellerCtx.close();
  await moderatorCtx.close();
  await buyerCtx.close();
});
