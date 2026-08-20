import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { randomInt } from 'crypto';
import { User } from '../users/user.entity';
import { Profile } from '../profiles/profile.entity';
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
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER_TOKEN) private readonly sms: SmsProvider,
  ) {}

  async requestOtp(phone: string, ip: string | null, purpose: 'login' | 'verify' = 'login'): Promise<{ requested: true }> {
    // Постійний код лише для одного номера (FIXED_OTP_PHONE), явно за проханням користувача —
    // усвідомлений компроміс: незмінний код на цей номер діє як постійний бекдор в акаунт,
    // тож НЕ узагальнюємо цей механізм на інші номери без окремого явного запиту.
    const fixedPhone = this.config.get<string>('FIXED_OTP_PHONE');
    const fixedCode = this.config.get<string>('FIXED_OTP_CODE');
    const code = phone === fixedPhone && fixedCode ? fixedCode : String(randomInt(100000, 999999));
    const codeHash = await argon2.hash(code);

    await this.otpCodes.save(
      this.otpCodes.create({
        phone,
        codeHash,
        purpose,
        maxAttempts: OTP_MAX_ATTEMPTS,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
        createdIp: ip,
      }),
    );

    // SMS_PROVIDER=console|twilio — реалізація обирається в sms.module.ts.
    await this.sms.send(phone, `Код підтвердження Вжик: ${code}`);

    return { requested: true };
  }

  /** Спільна перевірка коду для verifyOtp() (purpose=login) і linkPhone() (purpose=verify) — консьюмить otp-рядок. */
  private async consumeOtp(phone: string, code: string, purpose: 'login' | 'verify'): Promise<void> {
    const otp = await this.otpCodes.findOne({
      where: { phone, consumedAt: undefined, purpose },
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
  }

  async verifyOtp(phone: string, code: string) {
    await this.consumeOtp(phone, code, 'login');

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
   * Прив'язка верифікованого номера до вже автентифікованого юзера (профіль → "Додати номер
   * телефону") — на відміну від verifyOtp() не створює новий акаунт і не видає токени заново.
   */
  async linkPhone(userId: string, phone: string, code: string) {
    await this.consumeOtp(phone, code, 'verify');

    const existing = await this.users.findOne({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw new ConflictException({ code: 'PHONE_TAKEN', message: 'Цей номер телефону вже прив’язано до іншого акаунту' });
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }
    user.phone = phone;
    user.phoneVerifiedAt = new Date();
    await this.users.save(user);

    return { phone: user.phone };
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
      // Google вже підтвердив ім'я — не змушуємо юзера вводити його вручну, якщо він його надав.
      if (profile.displayName) {
        await this.profiles.save(this.profiles.create({ userId: user.id, displayName: profile.displayName }));
      }
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
