import { Global, Module } from '@nestjs/common';
import { redisProvider } from './redis.provider';
import { RateLimitService } from '../shared/rate-limit.service';

/**
 * Redis: сесії/refresh-token revoke-list, rate limiting, кеш налаштувань і пошукових
 * запитів, черги (BullMQ) — docs/architecture.md §2.
 */
@Global()
@Module({
  providers: [redisProvider, RateLimitService],
  exports: [redisProvider, RateLimitService],
})
export class RedisModule {}
