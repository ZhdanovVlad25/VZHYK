import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../providers/redis.provider';

/**
 * docs/security.md §6 — per-user ліміти (listings create, chat messages, reports),
 * на відміну від per-phone OTP-лімітів (OtpPhoneThrottlerGuard), не через
 * ThrottlerGuard: глобальний APP_GUARD виконується до JwtAuthGuard, тож req.user ще
 * не заповнений (та сама причина, що roadmap.md grabli #3/#11) — простіший і
 * надійніший шлях: явний Redis INCR+EXPIRE у сервісному шарі, той самий патерн прямого
 * доступу до REDIS_CLIENT, що вже використовують SettingsService/CategoriesService.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Кидає 429 RATE_LIMIT_EXCEEDED, якщо ключ перевищив ліміт у поточному вікні. */
  async consume(key: string, limit: number, windowSeconds: number): Promise<void> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    if (count > limit) {
      throw new HttpException(
        { code: 'RATE_LIMIT_EXCEEDED', message: 'Забагато запитів, спробуйте пізніше' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
