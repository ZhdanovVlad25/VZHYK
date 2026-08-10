import { IsOptional, IsUUID } from 'class-validator';

export class CreateChatDto {
  @IsUUID()
  otherUserId: string;

  @IsOptional()
  @IsUUID()
  listingId?: string;
}
