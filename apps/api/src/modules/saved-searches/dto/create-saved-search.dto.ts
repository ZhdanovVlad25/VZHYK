import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

export class CreateSavedSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  queryText?: string;

  @IsOptional()
  @IsUuidLike()
  categoryId?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsUuidLike()
  regionLocationId?: string;
}
