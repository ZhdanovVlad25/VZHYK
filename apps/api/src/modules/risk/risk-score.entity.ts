import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';

const numericTransformer = { to: (v?: number) => v, from: (v?: string) => (v === undefined ? undefined : parseFloat(v)) };

/** docs/database.md "### risk_signals / risk_scores" — одна агрегована оцінка на юзера. */
@Entity('risk_scores')
export class RiskScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'numeric', precision: 8, scale: 2, default: 0, transformer: numericTransformer })
  score: number;

  /** Явний @Column, не @UpdateDateColumn — оновлюється через upsert() у RiskService, не .save(), тож авто-timestamp декоратора тут ненадійний. */
  @Column({ type: 'timestamptz' })
  lastCalculatedAt: Date;
}
