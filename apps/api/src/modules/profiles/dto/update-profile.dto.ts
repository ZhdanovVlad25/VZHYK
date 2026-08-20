import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

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
  @IsUuidLike()
  cityLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  /** Немає окремого endpoint для аватарки в цьому зрізі — приймаємо ID вже завантаженого Media. */
  @IsOptional()
  @IsUuidLike()
  avatarMediaId?: string;
}
