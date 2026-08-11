import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export interface RecordAuditLogInput {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
}

/** docs/security.md §7 — фіксується явним викликом record() у місці мутації, не generic interceptor'ом (лічені call-сайти, TODO якщо їх стане багато). */
@Injectable()
export class AuditLogService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  async record(input: RecordAuditLogInput): Promise<void> {
    await this.logs.save(
      this.logs.create({
        actorUserId: input.actorUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        ip: input.ip ?? null,
      }),
    );
  }

  /** Без keyset-пагінації, як і решта MVP list-ендпоінтів (favorites/saved-searches) — обмежено останніми 100. */
  list(): Promise<AuditLog[]> {
    return this.logs.find({ order: { createdAt: 'DESC' }, take: 100 });
  }
}
