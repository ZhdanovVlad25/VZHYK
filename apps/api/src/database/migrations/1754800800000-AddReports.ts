import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 4 — Reports (громадянське репортування; черга модерації — окремо, пізніше). docs/api.md §10. */
export class AddReports1754800800000 implements MigrationInterface {
  name = 'AddReports1754800800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "report_target_type_enum" AS ENUM ('LISTING', 'USER', 'CHAT');
      CREATE TYPE "report_reason_enum" AS ENUM ('SPAM', 'FRAUD', 'PROHIBITED_ITEM', 'OFFENSIVE_CONTENT', 'DUPLICATE', 'OTHER');
      CREATE TYPE "report_status_enum" AS ENUM ('PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED');

      CREATE TABLE "reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "reporterId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "targetType" "report_target_type_enum" NOT NULL,
        "targetId" uuid NOT NULL,
        "reason" "report_reason_enum" NOT NULL,
        "description" varchar(1000),
        "status" "report_status_enum" NOT NULL DEFAULT 'PENDING',
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_reports_reporter" ON "reports" ("reporterId");
      CREATE INDEX "idx_reports_target" ON "reports" ("targetType", "targetId");
      CREATE INDEX "idx_reports_status" ON "reports" ("status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "reports";
      DROP TYPE IF EXISTS "report_status_enum";
      DROP TYPE IF EXISTS "report_reason_enum";
      DROP TYPE IF EXISTS "report_target_type_enum";
    `);
  }
}
