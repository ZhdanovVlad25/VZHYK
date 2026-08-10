import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * docs/database.md §2 app_settings — конфігуровані бізнес-параметри без хардкоду.
 * MVP-ключі: listing.max_active_per_user (5), pii.retention_months (6),
 * moderation.forbidden_words, rate-limit пороги.
 */
@Entity('app_settings')
export class AppSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
