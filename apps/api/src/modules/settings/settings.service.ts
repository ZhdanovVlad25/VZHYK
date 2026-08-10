import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { AppSetting } from './app-setting.entity';
import { REDIS_CLIENT } from '../../providers/redis.provider';

const CACHE_TTL_SECONDS = 60;
const CACHE_PREFIX = 'app_settings:';

/**
 * Читає конфігуровані бізнес-параметри (docs/architecture.md "SettingsService").
 * Ключі редагуються з Admin Panel (app_settings таблиця), кешуються в Redis,
 * щоб не бити в БД на кожен запит (напр. на кожну публікацію оголошення).
 */
@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async get<T = unknown>(key: string, fallback: T): Promise<T> {
    const cacheKey = CACHE_PREFIX + key;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }

    const row = await this.repo.findOne({ where: { key } });
    const value = (row?.value as T) ?? fallback;
    await this.redis.set(cacheKey, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    return value;
  }

  async set(key: string, value: unknown, updatedBy?: string, description?: string): Promise<void> {
    await this.repo.upsert(
      { key, value, updatedBy: updatedBy ?? null, description: description ?? null } as QueryDeepPartialEntity<AppSetting>,
      ['key'],
    );
    await this.redis.del(CACHE_PREFIX + key);
  }

  /** decisions.md DEC-05 — ліміт активних оголошень, default 5 */
  getMaxActiveListingsPerUser(): Promise<number> {
    return this.get<number>('listing.max_active_per_user', 5);
  }

  /** decisions.md DEC-04 — retention period PII, default 6 місяців */
  getPiiRetentionMonths(): Promise<number> {
    return this.get<number>('pii.retention_months', 6);
  }
}
