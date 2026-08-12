import { test, expect } from '@playwright/test';
import { loginViaOtp } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/**
 * docs/testing.md §3 сценарій 3 — створення оголошення. `publish()` НЕ авто-схвалює
 * (Phase 4) — сценарій закінчується на PENDING_MODERATION, доведення до ACTIVE
 * покриває сценарій 4/10 (модерація). Seed-категорії без required-атрибутів (перевірено
 * в seed-міграції), тож форма проходить без категорієзалежних полів.
 */
test('користувач створює й публікує оголошення (тип "Продаю")', async ({ page }) => {
  await loginViaOtp(page, uniquePhone());
  const title = uniqueTitle('Ноутбук Dell Inspiron');

  await page.goto('/listings/new');
  await page.getByRole('button', { name: 'Категорія' }).click();
  await page.getByRole('option').first().click();

  await page.getByLabel('Назва').fill(title);
  await page.getByLabel('Ціна, грн').fill('15000');
  await page.getByRole('button', { name: 'Створити чернетку' }).click();

  await page.waitForURL(/\/listings\/.+\/edit/);
  await expect(page.getByText('DRAFT')).toBeVisible();

  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('PENDING_MODERATION')).toBeVisible();
});
