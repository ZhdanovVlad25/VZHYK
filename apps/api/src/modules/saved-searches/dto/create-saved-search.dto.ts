import { IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateSavedSearchDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  queryText?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  regionLocationId?: string;
}
