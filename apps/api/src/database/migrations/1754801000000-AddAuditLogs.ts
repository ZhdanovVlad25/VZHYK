import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 4 — Audit log. docs/database.md "### audit_logs", docs/security.md §7. Append-only. */
export class AddAuditLogs1754801000000 implements MigrationInterface {
  name = 'AddAuditLogs1754801000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actorUserId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
        "action" varchar(100) NOT NULL,
        "targetType" varchar(50) NOT NULL,
        "targetId" uuid,
        "before" jsonb,
        "after" jsonb,
        "ip" varchar(64),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_audit_logs_actor_created" ON "audit_logs" ("actorUserId", "createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs";`);
  }
}
