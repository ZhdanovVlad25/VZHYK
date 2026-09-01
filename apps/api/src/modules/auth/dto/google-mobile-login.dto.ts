import { IsString, MinLength } from 'class-validator';

export class GoogleMobileLoginDto {
  @IsString()
  @MinLength(20)
  idToken: string;
}
