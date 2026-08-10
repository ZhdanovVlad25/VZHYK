import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameUk?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug має бути у форматі kebab-case (лише a-z, 0-9, дефіс)',
  })
  slug?: string;

  /** Переміщення категорії в дереві (docs/api.md §4). null = зробити top-level. */
  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
