import { Body, Controller, Get, Ip, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

interface GoogleProfile {
  googleId: string;
  email: string | null;
  displayName: string | null;
}

/** docs/api.md §2 Auth */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

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

  /** Ініціює redirect на Google consent screen — сам handler ніколи не виконується. */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  /**
   * Passport вже виконав GoogleStrategy.validate() і поклав профіль у req.user.
   * Немає SPA popup-флоу — це класичний server redirect, тож токени повертаємо
   * фронтенду через query-параметри редіректу на /auth/google/callback (там же
   * localStorage-based AuthContext, що й у Phone OTP флоу — жодних httpOnly cookies
   * в цьому зрізі, див. auth-context.tsx). Продакшн: короткоживучий exchange-код
   * замість сирих токенів у URL (не осідають в browser history/access logs).
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const tokens = await this.auth.loginWithGoogle(req.user as GoogleProfile);
    const webOrigin = this.config.get<string>('WEB_ORIGIN') || 'http://localhost:3000';
    const redirectUrl = new URL('/auth/google/callback', webOrigin);
    redirectUrl.searchParams.set('accessToken', tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
    res.redirect(redirectUrl.toString());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
