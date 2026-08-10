import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 2 — Media upload pipeline: media table. docs/database.md §2, docs/security.md §5. */
export class AddMedia1754800200000 implements MigrationInterface {
  name = 'AddMedia1754800200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "media_moderation_status_enum" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW');
    `);

    await queryRunner.query(`
      CREATE TABLE "media" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId" uuid REFERENCES "listings"("id") ON DELETE CASCADE,
        "ownerUserId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "storageKey" varchar(500) NOT NULL,
        "mimeType" varchar(100) NOT NULL,
        "sizeBytes" int NOT NULL,
        "width" int,
        "height" int,
        "isMain" boolean NOT NULL DEFAULT false,
        "sortOrder" int NOT NULL DEFAULT 0,
        "moderationStatus" media_moderation_status_enum NOT NULL DEFAULT 'PENDING',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_media_listing" ON "media" ("listingId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "media";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "media_moderation_status_enum";`);
  }
}
