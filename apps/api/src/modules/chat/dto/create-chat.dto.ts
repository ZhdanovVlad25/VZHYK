import { IsOptional } from 'class-validator';
import { IsUuidLike } from '../../../shared/validators/is-uuid-like.decorator';

export class CreateChatDto {
  @IsUuidLike()
  otherUserId: string;

  @IsOptional()
  @IsUuidLike()
  listingId?: string;
}
