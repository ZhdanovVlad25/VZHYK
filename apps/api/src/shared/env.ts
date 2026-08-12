import { ConfigService } from '@nestjs/config';

/**
 * Знайдено на Phase 8 security review: JWT_ACCESS_SECRET мав хардкодний fallback
 * ('dev_only_secret') у auth.module.ts/jwt.strategy.ts — якщо змінну забудуть задати
 * в production, застосунок мовчки підписував/перевіряв токени публічним,
 * легко вгадуваним секретом замість fail fast. Той самий принцип, що
 * resolveCorsOrigin() у main.ts — обов'язкові production-секрети не мають default'ів.
 */
export function requireEnv(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) {
    throw new Error(`${key} не задано — обов'язкова змінна середовища.`);
  }
  return value;
}
