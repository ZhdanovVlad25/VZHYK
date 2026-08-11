import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 4 — Anti-Fraud basics. docs/moderation.md §6, docs/database.md "### risk_signals / risk_scores". */
export class AddRiskSignals1754801100000 implements MigrationInterface {
  name = 'AddRiskSignals1754801100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "risk_signal_type_enum" AS ENUM (
        'rapid_listing_creation', 'duplicate_listings', 'high_report_count',
        'mass_messaging', 'multi_account_signal', 'location_mismatch'
      );

      CREATE TABLE "risk_signals" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "signalType" "risk_signal_type_enum" NOT NULL,
        "weight" numeric(6,2) NOT NULL,
        "metadata" jsonb,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_risk_signals_user" ON "risk_signals" ("userId");

      CREATE TABLE "risk_scores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "score" numeric(8,2) NOT NULL DEFAULT 0,
        "lastCalculatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "risk_scores";
      DROP TABLE IF EXISTS "risk_signals";
      DROP TYPE IF EXISTS "risk_signal_type_enum";
    `);
  }
}
