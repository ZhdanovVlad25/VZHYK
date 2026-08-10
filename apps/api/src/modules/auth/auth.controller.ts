import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §2 Auth */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @Throttle({ default: { limit: 3, ttl: 900_000 } }) // 3/15хв на номер (додатково per-IP на рівні Redis guard)
  requestOtp(@Body() dto: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(dto.phone, ip);
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 5, ttl: 300_000 } }) // 5 спроб на код
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  // POST /auth/google — ініціюється через GoogleStrategy (redirect flow),
  // GET /auth/google/callback — обробляє callback і видає tokens (див. google.strategy.ts).
  // Повна маршрутизація AuthGuard('google') додається разом з frontend OAuth flow у наступному кроці.

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
