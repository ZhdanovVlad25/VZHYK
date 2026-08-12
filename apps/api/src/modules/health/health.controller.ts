import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../../providers/redis.provider';

/**
 * Liveness/readiness для оркестратора/LB. Свідомо поза /api/v1 (setGlobalPrefix exclude
 * в main.ts) — health-check конвенційно живе на стабільному шляху незалежно від версії API.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: import('ioredis').default,
  ) {}

  @Get()
  async check(): Promise<{ status: 'ok'; db: 'ok'; redis: 'ok' }> {
    const [dbOk, redisOk] = await Promise.all([
      this.pingDb(),
      this.pingRedis(),
    ]);

    if (!dbOk || !redisOk) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Залежність недоступна',
        details: { db: dbOk ? 'ok' : 'down', redis: redisOk ? 'ok' : 'down' },
      });
    }

    return { status: 'ok', db: 'ok', redis: 'ok' };
  }

  private async pingDb(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
