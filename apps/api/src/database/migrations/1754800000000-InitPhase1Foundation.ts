import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 — Foundation: users, otp_codes, profiles, locations, categories,
 * category_attributes, app_settings. Індекси/constraints — docs/database.md §3–4.
 */
export class InitPhase1Foundation1754800000000 implements MigrationInterface {
  name = 'InitPhase1Foundation1754800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('user', 'moderator', 'admin', 'system');
      CREATE TYPE "user_status_enum" AS ENUM ('active', 'blocked', 'deleted');
      CREATE TYPE "otp_purpose_enum" AS ENUM ('login', 'verify');
      CREATE TYPE "location_level_enum" AS ENUM ('country', 'region', 'city', 'district');
      CREATE TYPE "attribute_data_type_enum" AS ENUM ('string', 'number', 'boolean', 'enum', 'multi_enum', 'range');
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phone" varchar(32) UNIQUE,
        "phoneVerifiedAt" timestamptz,
        "email" varchar(255) UNIQUE,
        "googleId" varchar(255) UNIQUE,
        "passwordHash" varchar(255),
        "role" user_role_enum NOT NULL DEFAULT 'user',
        "status" user_status_enum NOT NULL DEFAULT 'active',
        "deletedAt" timestamptz,
        "lastActiveAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_users_phone" ON "users" ("phone");
    `);

    await queryRunner.query(`
      CREATE TABLE "otp_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "phone" varchar(32) NOT NULL,
        "codeHash" varchar(255) NOT NULL,
        "purpose" otp_purpose_enum NOT NULL DEFAULT 'login',
        "attemptsCount" int NOT NULL DEFAULT 0,
        "maxAttempts" int NOT NULL DEFAULT 5,
        "expiresAt" timestamptz NOT NULL,
        "consumedAt" timestamptz,
        "createdIp" varchar(64),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_otp_codes_phone" ON "otp_codes" ("phone");
    `);

    await queryRunner.query(`
      CREATE TABLE "locations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "parentId" uuid REFERENCES "locations"("id") ON DELETE RESTRICT,
        "level" location_level_enum NOT NULL,
        "nameUk" varchar(120) NOT NULL,
        "slug" varchar(140) NOT NULL,
        "lat" double precision,
        "lng" double precision,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_locations_parent" ON "locations" ("parentId");
    `);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "parentId" uuid REFERENCES "categories"("id") ON DELETE RESTRICT,
        "nameUk" varchar(120) NOT NULL,
        "slug" varchar(140) NOT NULL,
        "icon" varchar(60),
        "sortOrder" int NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "level" smallint NOT NULL DEFAULT 0,
        "deletedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "idx_categories_parent_slug" ON "categories" ("parentId", "slug");
    `);

    await queryRunner.query(`
      CREATE TABLE "category_attributes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "categoryId" uuid NOT NULL REFERENCES "categories"("id") ON DELETE CASCADE,
        "key" varchar(60) NOT NULL,
        "labelUk" varchar(120) NOT NULL,
        "dataType" attribute_data_type_enum NOT NULL,
        "enumOptions" jsonb,
        "isRequired" boolean NOT NULL DEFAULT false,
        "isFilterable" boolean NOT NULL DEFAULT false,
        "sortOrder" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_category_attributes_category" ON "category_attributes" ("categoryId");
    `);

    await queryRunner.query(`
      CREATE TABLE "profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "avatarMediaId" uuid,
        "displayName" varchar(120),
        "username" varchar(60) UNIQUE,
        "cityLocationId" uuid REFERENCES "locations"("id"),
        "bio" text,
        "rating" numeric(3,2),
        "reviewsCount" int,
        "activeListingsCount" int NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "app_settings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key" varchar(120) NOT NULL UNIQUE,
        "value" jsonb NOT NULL,
        "description" text,
        "updatedBy" uuid,
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Seed бізнес-параметрів з Phase 1 Authorization (decisions.md DEC-04, DEC-05)
    await queryRunner.query(`
      INSERT INTO "app_settings" ("key", "value", "description") VALUES
      ('listing.max_active_per_user', '5', 'Максимум активних оголошень для звичайного користувача (decisions.md DEC-05)'),
      ('pii.retention_months', '6', 'Термін зберігання персональних даних після видалення акаунта, місяців (decisions.md DEC-04)');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_settings";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "profiles";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "category_attributes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "locations";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "otp_codes";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "attribute_data_type_enum";
      DROP TYPE IF EXISTS "location_level_enum";
      DROP TYPE IF EXISTS "otp_purpose_enum";
      DROP TYPE IF EXISTS "user_status_enum";
      DROP TYPE IF EXISTS "user_role_enum";
    `);
  }
}
