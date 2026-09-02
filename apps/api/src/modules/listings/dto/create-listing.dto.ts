import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  LISTING_CONDITIONS,
  LISTING_CURRENCIES,
  LISTING_TYPES,
  ListingCondition,
  ListingCurrency,
  ListingType,
} from '../listing.constants';
import { AttributeValueInputDto } from './attribute-value-input.dto';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

export class CreateListingDto {
  @IsUuidLike()
  categoryId: string;

  @IsIn(LISTING_TYPES)
  listingType: ListingType;

  @IsString()
  @MinLength(5)
  @MaxLength(140)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsIn(LISTING_CURRENCIES)
  currency?: ListingCurrency;

  @IsOptional()
  @IsBoolean()
  isNegotiable?: boolean;

  @IsOptional()
  @IsIn(LISTING_CONDITIONS)
  condition?: ListingCondition;

  @IsOptional()
  @IsUuidLike()
  locationId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AttributeValueInputDto)
  attributes?: AttributeValueInputDto[];

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}
