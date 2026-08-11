import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { REPORT_REASONS, REPORT_STATUSES, REPORT_TARGET_TYPES, ReportReason, ReportStatus, ReportTargetType } from './report.constants';

/**
 * docs/api.md §10 Reports — громадянське репортування (listing/user/chat).
 * targetId навмисно без FK — ціль поліморфна (різні таблиці залежно від targetType),
 * існування цілі перевіряється в сервісі на POST, а не на рівні схеми.
 * Черга модерації (admin decide/resolve) — Phase 4/5, тут лише PENDING-створення.
 */
@Entity('reports')
@Index(['targetType', 'targetId'])
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporterId' })
  reporter: User;

  @Column({ type: 'uuid' })
  reporterId: string;

  @Column({ type: 'enum', enum: REPORT_TARGET_TYPES })
  targetType: ReportTargetType;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({ type: 'enum', enum: REPORT_REASONS })
  reason: ReportReason;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: REPORT_STATUSES, default: 'PENDING' })
  status: ReportStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
