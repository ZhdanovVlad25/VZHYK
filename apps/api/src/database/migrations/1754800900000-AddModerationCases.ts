import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 4 — Moderation queue, замінює авто-approve в ListingsService.publish(). docs/api.md §12. */
export class AddModerationCases1754800900000 implements MigrationInterface {
  name = 'AddModerationCases1754800900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "moderation_case_status_enum" AS ENUM ('PENDING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');

      CREATE TABLE "moderation_cases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId" uuid NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
        "status" "moderation_case_status_enum" NOT NULL DEFAULT 'PENDING',
        "autoFlagReason" varchar(200),
        "moderatorId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "decidedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_moderation_cases_listing" ON "moderation_cases" ("listingId");
      CREATE INDEX "idx_moderation_cases_status" ON "moderation_cases" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "moderation_cases";
      DROP TYPE IF EXISTS "moderation_case_status_enum";
    `);
  }
}
