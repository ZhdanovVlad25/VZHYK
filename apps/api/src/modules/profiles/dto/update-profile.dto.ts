import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(/^[a-z0-9_]+$/, { message: 'username може містити лише малі латинські літери, цифри та підкреслення' })
  username?: string;

  @IsOptional()
  @IsUUID()
  cityLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  /** Немає окремого endpoint для аватарки в цьому зрізі — приймаємо ID вже завантаженого Media. */
  @IsOptional()
  @IsUUID()
  avatarMediaId?: string;
}
