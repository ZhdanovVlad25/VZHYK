import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { RISK_SIGNAL_TYPES, RiskSignalType } from './risk.constants';

/** Numeric-колонки Postgres повертаються як string через pg-driver — приводимо до number. */
const numericTransformer = { to: (v?: number) => v, from: (v?: string) => (v === undefined ? undefined : parseFloat(v)) };

/** docs/database.md "### risk_signals / risk_scores", docs/moderation.md §6. */
@Entity('risk_signals')
@Index(['userId'])
export class RiskSignal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: RISK_SIGNAL_TYPES })
  signalType: RiskSignalType;

  @Column({ type: 'numeric', precision: 6, scale: 2, transformer: numericTransformer })
  weight: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
