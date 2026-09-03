import { Body, Controller, Get, Ip, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleMobileLoginDto } from './dto/google-mobile-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
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
  @Throttle({ default: { limit: 3, ttl: 900_000 } }) // 3/15хв на номер — глобальний OtpPhoneThrottlerGuard (app.module.ts) трекає за phone, не IP
  requestOtp(@Body() dto: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(dto.phone, ip);
  }

  @Post('otp/verify')
  @Throttle({ default: { limit: 5, ttl: 300_000 } }) // 5 спроб на код, теж за phone
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
    // WEB_ORIGIN може містити кілька origin через кому (main.ts resolveCorsOrigin, для CORS
    // на перехідний період зі старим Railway-доменом) — редирект бере ПЕРШИЙ, це основний,
    // "справжній" домен сайту (vzhyk.in.ua), а не випадковий/старий.
    const webOrigin = (this.config.get<string>('WEB_ORIGIN') || 'http://localhost:3000').split(',')[0].trim();
    const redirectUrl = new URL('/auth/google/callback', webOrigin);
    redirectUrl.searchParams.set('accessToken', tokens.accessToken);
    redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
    res.redirect(redirectUrl.toString());
  }

  /**
   * Мобільний (RN AuthSession) Google-вхід — клієнт сам домовляється з Google і надсилає
   * нам готовий ID-токен, ніякого server redirect тут нема (на відміну від /google →
   * /google/callback вище, того самого патерну, що веб). Throttle за IP — токен уже
   * підписаний Google, зайвого сенсу брутфорсити тут нема, ліміт лише проти зловживання.
   */
  @Post('google/mobile')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  googleMobileLogin(@Body() dto: GoogleMobileLoginDto) {
    return this.auth.loginWithGoogleIdToken(dto.idToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  /** Без цього access token (15 хв) визначав фактичну тривалість сесії попри 30-денний refreshToken. */
  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  /**
   * Профіль → "Додати номер телефону" — добровільна дія автентифікованого юзера, не частина
   * онбордингу. Перевіряємо зайнятість номера ДО відправки SMS — інакше юзер дізнавався б
   * про зайнятий номер лише після реального (платного) SMS і введеного коду.
   */
  @Post('phone/request')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  async requestPhoneLink(@Body() dto: RequestOtpDto, @Ip() ip: string, @CurrentUser() user: AuthenticatedUser) {
    await this.auth.assertPhoneAvailableForLink(user.id, dto.phone);
    return this.auth.requestOtp(dto.phone, ip, 'verify');
  }

  @Post('phone/link')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  linkPhone(@Body() dto: VerifyOtpDto, @CurrentUser() user: AuthenticatedUser) {
    return this.auth.linkPhone(user.id, dto.phone, dto.code);
  }
}
