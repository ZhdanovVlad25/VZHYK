import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Min, MaxLength } from 'class-validator';
import { AttributeDataType } from '../category-attribute.entity';

const DATA_TYPES: AttributeDataType[] = ['string', 'number', 'boolean', 'enum', 'multi_enum', 'range'];

export class CreateAttributeDto {
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'key має бути у форматі snake_case, починатись з літери',
  })
  key: string;

  @IsString()
  @MaxLength(120)
  labelUk: string;

  @IsIn(DATA_TYPES)
  dataType: AttributeDataType;

  /** enum_options з опційним parent_key для залежних атрибутів (docs/categories.md §2) */
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
