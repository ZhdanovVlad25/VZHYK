import { IsString, MaxLength, MinLength } from 'class-validator';

/** Лише текст у цьому зрізі — mediaIds заповнюється, коли з'явиться chat-специфічний upload. */
export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
