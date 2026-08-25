import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Одноразовий фікс даних: власник проєкту мав ДВА окремих акаунти — один заведений через
 * Google (реальні оголошення, displayName "Влад"), інший через FIXED_OTP_PHONE
 * (+380963634357, лише role='admin', жодних реальних даних, окрім тестових оголошень з цієї
 * сесії). Вхід через Google не давав admin, бо loginWithGoogle() шукає юзера за googleId/email,
 * а не за phone — два різних users-рядки для однієї людини.
 *
 * Зливаємо в один: реальний Google-акаунт отримує phone+role='admin', тестовий акаунт
 * видаляється (CASCADE прибирає його тестові оголошення/профіль/тощо; audit_log і
 * moderation_cases мають RESTRICT/SET NULL на userId — переприв'язуємо їх заздалегідь,
 * щоб delete не впав і щоб історія лишалась коректно приписаною).
 */
const TEST_ADMIN_USER_ID = 'e11660b7-9258-4eb8-9ccb-1f7e4f6f5ff7';
const REAL_GOOGLE_USER_ID = 'aab4def6-9583-444c-acf4-825d35d0315d';
const ADMIN_PHONE = '+380963634357';

export class MergeGoogleAndAdminAccounts1754801800000 implements MigrationInterface {
  name = 'MergeGoogleAndAdminAccounts1754801800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "audit_logs" SET "actorUserId" = $1 WHERE "actorUserId" = $2`, [
      REAL_GOOGLE_USER_ID,
      TEST_ADMIN_USER_ID,
    ]);
    await queryRunner.query(`UPDATE "moderation_cases" SET "moderatorId" = $1 WHERE "moderatorId" = $2`, [
      REAL_GOOGLE_USER_ID,
      TEST_ADMIN_USER_ID,
    ]);
    // CASCADE прибирає: listings (+ media/price_history/listing_attribute_values/moderation_cases
    // цих listings), profiles, favorites, chat_participants, messages, risk_score, risk_signals,
    // saved_searches, reports (reporterId) — усі onDelete: 'CASCADE' на userId (docs/database.md).
    await queryRunner.query(`DELETE FROM "users" WHERE "id" = $1`, [TEST_ADMIN_USER_ID]);
    await queryRunner.query(`UPDATE "users" SET "phone" = $1, "role" = 'admin' WHERE "id" = $2`, [
      ADMIN_PHONE,
      REAL_GOOGLE_USER_ID,
    ]);
  }

  public async down(): Promise<void> {
    // Злиття акаунтів необоротне (видалений юзер і його дані не відновлюються) —
    // down() навмисно порожній, як і для інших одноразових data-фіксів у цьому проєкті.
  }
}
