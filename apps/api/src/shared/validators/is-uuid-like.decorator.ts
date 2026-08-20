import { registerDecorator, ValidationOptions } from 'class-validator';

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres-колонка `uuid` приймає будь-який рядок формату 8-4-4-4-12 hex — без
 * обов'язкового RFC4122 version/variant-ніббла, який вимагає class-validator's @IsUUID().
 * Частина id у цій базі (напр. сидові користувачі "11111111-1111-1111-1111-111111111110")
 * цьому суворішому чеку не відповідає, хоча є валідними значеннями колонки. Матчимо формат
 * колонки, а не бібліотечний "канонічний" UUID — щоб такі id проходили валідацію скрізь,
 * де вони приходять назад від клієнта (seller/otherUserId/targetId/categoryId тощо).
 */
export function IsUuidLike(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isUuidLike',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && UUID_LIKE.test(value);
        },
        defaultMessage(args) {
          return `${args?.property} must be a UUID`;
        },
      },
    });
  };
}
