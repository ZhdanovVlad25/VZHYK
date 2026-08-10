import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { AttributeDataType } from '../category-attribute.entity';

const DATA_TYPES: AttributeDataType[] = ['string', 'number', 'boolean', 'enum', 'multi_enum', 'range'];

/** key і categoryId незмінні після створення — на них у майбутньому посилається ListingAttributeValue. */
export class UpdateAttributeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  labelUk?: string;

  @IsOptional()
  @IsIn(DATA_TYPES)
  dataType?: AttributeDataType;

  @IsOptional()
  @IsObject()
  enumOptions?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
