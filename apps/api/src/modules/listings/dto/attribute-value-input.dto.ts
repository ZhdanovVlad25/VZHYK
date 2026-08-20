import { IsDefined } from 'class-validator';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

/**
 * value без строгого декоратора типу — форма (string/number/boolean/масив/{min,max})
 * залежить від CategoryAttribute.dataType і валідується в ListingsService.
 * @IsDefined() лише реєструє поле для whitelist ValidationPipe і вимагає його наявність.
 */
export class AttributeValueInputDto {
  @IsUuidLike()
  categoryAttributeId: string;

  @IsDefined()
  value: unknown;
}
