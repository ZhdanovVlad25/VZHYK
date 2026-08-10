import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — Listings core: listings, listing_attribute_values.
 * State machine — docs/architecture.md §6. Індекси — docs/database.md §4.
 */
export class AddListingsCore1754800100000 implements MigrationInterface {
  name = 'AddListingsCore1754800100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "listing_type_enum" AS ENUM ('sell', 'buy', 'exchange', 'give_away', 'service', 'rent');
      CREATE TYPE "listing_currency_enum" AS ENUM ('UAH', 'USD', 'EUR');
      CREATE TYPE "listing_condition_enum" AS ENUM ('new', 'used', 'for_parts');
      CREATE TYPE "listing_status_enum" AS ENUM (
        'DRAFT', 'PENDING_MODERATION', 'ACTIVE', 'REJECTED', 'RESERVED',
        'SOLD', 'EXPIRED', 'ARCHIVED', 'BLOCKED'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "listings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "categoryId" uuid NOT NULL REFERENCES "categories"("id") ON DELETE RESTRICT,
        "listingType" listing_type_enum NOT NULL,
        "title" varchar(140) NOT NULL,
        "description" text,
        "price" numeric(12,2),
        "currency" listing_currency_enum NOT NULL DEFAULT 'UAH',
        "isNegotiable" boolean NOT NULL DEFAULT false,
        "condition" listing_condition_enum,
        "locationId" uuid REFERENCES "locations"("id") ON DELETE RESTRICT,
        "status" listing_status_enum NOT NULL DEFAULT 'DRAFT',
        "viewsCount" int NOT NULL DEFAULT 0,
        "publishedAt" timestamptz,
        "expiresAt" timestamptz,
        "deletedAt" timestamptz,
        "version" int NOT NULL DEFAULT 1,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_listings_category_status_published" ON "listings" ("categoryId", "status", "publishedAt" DESC);
      CREATE INDEX "idx_listings_user_status" ON "listings" ("userId", "status");
      CREATE INDEX "idx_listings_location" ON "listings" ("locationId");
    `);

    await queryRunner.query(`
      CREATE TABLE "listing_attribute_values" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId" uuid NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
        "categoryAttributeId" uuid NOT NULL REFERENCES "category_attributes"("id") ON DELETE CASCADE,
        "value" jsonb NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "idx_listing_attribute_values_unique" ON "listing_attribute_values" ("listingId", "categoryAttributeId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "listing_attribute_values";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "listings";`);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "listing_status_enum";
      DROP TYPE IF EXISTS "listing_condition_enum";
      DROP TYPE IF EXISTS "listing_currency_enum";
      DROP TYPE IF EXISTS "listing_type_enum";
    `);
  }
}
