import { Client } from 'pg';
import * as argon2 from 'argon2';
import { Page, expect } from '@playwright/test';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://vzhyk:vzhyk_dev_password@localhost:5432/vzhyk';
export const OTP_CODE = '111111';

/**
 * Playwright — окремий OS-процес від API-сервера, тож на відміну від
 * apps/api/test/integration (той самий Node-процес, console.log spy) тут немає доступу
 * до `[otp] +380... -> code` логів API. Той самий трюк, що вручну проганявся цю сесію
 * (roadmap.md grabli #10): підміняємо argon2-хеш коду напряму в БД на відомий код.
 */
async function overrideOtpCode(phone: string): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const hash = await argon2.hash(OTP_CODE);
    await client.query(
      `UPDATE otp_codes SET "codeHash" = $1 WHERE id = (
         SELECT id FROM otp_codes WHERE phone = $2 AND "consumedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1
       )`,
      [hash, phone],
    );
  } finally {
    await client.end();
  }
}

/** Повний UI-флоу входу через `/login` (телефон → код) для вже відомого/нового номера. */
export async function loginViaOtp(page: Page, phone: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Номер телефону').fill(phone);
  await page.getByRole('button', { name: 'Надіслати код' }).click();
  // Дочекатись переходу на крок "код" — інакше otp/request ще не встиг завершитись і
  // рядок otp_codes ще не існує в БД, коли overrideOtpCode() намагається його оновити.
  await expect(page.getByLabel('Код підтвердження')).toBeVisible();
  await overrideOtpCode(phone);
  await page.getByLabel('Код підтвердження').fill(OTP_CODE);
  await page.getByRole('button', { name: 'Підтвердити' }).click();
  await expect(page.getByRole('button', { name: 'Вийти' })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Вийти' }).click();
}

export async function promoteRole(phone: string, role: 'admin' | 'moderator'): Promise<void> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`UPDATE users SET role = $1 WHERE phone = $2`, [role, phone]);
  } finally {
    await client.end();
  }
}

/**
 * Реєструє (якщо новий номер) + логінить, тоді промоутить роль у БД і перелогінює —
 * свіжий JWT з новою роллю в payload (роль береться з payload, не з БД на кожен запит,
 * roadmap.md grabli #10). Одноразові випадкові номери — без потреби відкочувати роль.
 */
export async function loginAsPrivileged(page: Page, phone: string, role: 'admin' | 'moderator'): Promise<void> {
  await loginViaOtp(page, phone);
  await logout(page);
  await promoteRole(phone, role);
  await loginViaOtp(page, phone);
}
