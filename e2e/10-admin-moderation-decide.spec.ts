import { test, expect } from '@playwright/test';
import { loginAsPrivileged, loginViaOtp, logout } from './helpers/auth';
import { uniquePhone, uniqueTitle } from './helpers/fixtures';

/**
 * docs/testing.md §3 сценарій 10 — admin moderation (черга, рішення). Покриває REJECTED
 * гілку рішення — APPROVED вже перевірено сценарієм 5, NEEDS_REVIEW (авто-флаг) —
 * сценарієм 4. "Повідомлення користувачу" з docs не покривається — notifications
 * abstraction не реалізована взагалі (roadmap.md Phase 3).
 */
test('модератор відхиляє оголошення з черги — REJECTED', async ({ page }) => {
  const title = uniqueTitle('Товар для відхилення');

  await loginViaOtp(page, uniquePhone());
  await page.goto('/listings/new');
  await page.getByRole('button', { name: 'Категорія' }).click();
  await page.getByRole('option').first().click();
  await page.getByLabel('Назва').fill(title);
  await page.getByLabel('Ціна, грн').fill('100');
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await page.waitForURL(/\/listings\/.+\/edit/);
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await logout(page);

  await loginAsPrivileged(page, uniquePhone(), 'moderator');
  await page.goto('/admin/moderation');
  const caseItem = page.locator('li', { hasText: title });
  await caseItem.getByRole('button', { name: 'Відхилити' }).click();

  await expect(caseItem.getByText('Відхилено')).toBeVisible();
});
