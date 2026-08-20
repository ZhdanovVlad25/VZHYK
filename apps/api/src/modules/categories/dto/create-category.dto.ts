import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(120)
  nameUk: string;

  @IsString()
  @MaxLength(140)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug має бути у форматі kebab-case (лише a-z, 0-9, дефіс)',
  })
  slug: string;

  @IsOptional()
  @IsUuidLike()
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
