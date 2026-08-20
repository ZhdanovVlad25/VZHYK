import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { User } from '../users/user.entity';
import { OtpCode } from './otp-code.entity';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../../providers/sms/sms-provider.interface';

const OTP_TTL_SECONDS = 300; // 5 хв, docs/security.md §1
const OTP_MAX_ATTEMPTS = 5;

/**
 * Auth foundation: Phone OTP + Google OAuth architecture, session issuance.
 * Rate limiting (3/15хв на номер, 10/год на IP) реалізується через ThrottlerGuard
 * на контролері (docs/security.md §6), тут — доменна логіка видачі/перевірки коду.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(OtpCode) private readonly otpCodes: Repository<OtpCode>,
    private readonly jwt: JwtService,
    @Inject(SMS_PROVIDER_TOKEN) private readonly sms: SmsProvider,
  ) {}

  async requestOtp(phone: string, ip: string | null): Promise<{ requested: true }> {
    const code = String(randomInt(100000, 999999));
    const codeHash = await argon2.hash(code);

    await this.otpCodes.save(
      this.otpCodes.create({
        phone,
        codeHash,
        purpose: 'login',
        maxAttempts: OTP_MAX_ATTEMPTS,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
        createdIp: ip,
      }),
    );

    // SMS_PROVIDER=console|twilio — реалізація обирається в sms.module.ts.
    await this.sms.send(phone, `Код підтвердження Вжик: ${code}`);

    return { requested: true };
  }

  async verifyOtp(phone: string, code: string) {
    const otp = await this.otpCodes.findOne({
      where: { phone, consumedAt: undefined, purpose: 'login' },
      order: { createdAt: 'DESC' },
    });

    if (!otp || otp.consumedAt) {
      throw new BadRequestException({ code: 'OTP_NOT_FOUND', message: 'Код не знайдено, запросіть новий' });
    }
    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({ code: 'OTP_EXPIRED', message: 'Код прострочено' });
    }
    if (otp.attemptsCount >= otp.maxAttempts) {
      throw new ForbiddenException({ code: 'OTP_MAX_ATTEMPTS', message: 'Перевищено кількість спроб' });
    }

    const isValid = await argon2.verify(otp.codeHash, code);
    if (!isValid) {
      otp.attemptsCount += 1;
      await this.otpCodes.save(otp);
      throw new BadRequestException({ code: 'OTP_INVALID', message: 'Невірний код' });
    }

    otp.consumedAt = new Date();
    await this.otpCodes.save(otp);

    let user = await this.users.findOne({ where: { phone } });
    if (!user) {
      user = await this.users.save(
        this.users.create({ phone, phoneVerifiedAt: new Date(), role: 'user', status: 'active' }),
      );
    } else if (!user.phoneVerifiedAt) {
      user.phoneVerifiedAt = new Date();
      await this.users.save(user);
    }

    return this.issueTokens(user);
  }

  /**
   * Google OAuth: googleId — первинний ключ пошуку. Якщо не знайдено, але є email, що вже
   * зареєстрований через Phone OTP (email був доданий пізніше через PATCH /profiles/me) —
   * прив'язуємо googleId до існуючого акаунту замість дубля. Інакше — новий OAuth-only юзер.
   */
  async loginWithGoogle(profile: { googleId: string; email: string | null; displayName: string | null }) {
    let user = await this.users.findOne({ where: { googleId: profile.googleId } });

    if (!user && profile.email) {
      user = await this.users.findOne({ where: { email: profile.email } });
      if (user) {
        user.googleId = profile.googleId;
        user = await this.users.save(user);
      }
    }

    if (!user) {
      user = await this.users.save(
        this.users.create({ googleId: profile.googleId, email: profile.email, role: 'user', status: 'active' }),
      );
    }

    return this.issueTokens(user);
  }

  /** Спільна точка для verifyOtp() і loginWithGoogle() — заблокований юзер не отримує нових токенів. */
  async issueTokens(user: User) {
    if (user.status !== 'active') {
      throw new ForbiddenException({ code: 'USER_BLOCKED', message: 'Обліковий запис заблоковано' });
    }

    const payload = { sub: user.id, role: user.role, phone: user.phone };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn: '15m' });
    const refreshToken = await this.jwt.signAsync(payload, { expiresIn: '30d' });
    // Продакшн: refreshToken зберігається у httpOnly secure cookie + revoke-list у Redis
    // (docs/security.md §1) — додається разом з sessions-модулем у наступному кроці Phase 1.
    return { accessToken, refreshToken, user: { id: user.id, role: user.role, phone: user.phone } };
  }

  async me(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.id, phone: user.phone, email: user.email, role: user.role, status: user.status };
  }
}
