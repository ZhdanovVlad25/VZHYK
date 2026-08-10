import { IsDefined, IsUUID } from 'class-validator';

/**
 * value без строгого декоратора типу — форма (string/number/boolean/масив/{min,max})
 * залежить від CategoryAttribute.dataType і валідується в ListingsService.
 * @IsDefined() лише реєструє поле для whitelist ValidationPipe і вимагає його наявність.
 */
export class AttributeValueInputDto {
  @IsUUID()
  categoryAttributeId: string;

  @IsDefined()
  value: unknown;
}
