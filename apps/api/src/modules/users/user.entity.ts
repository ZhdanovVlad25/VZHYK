import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole = 'user' | 'moderator' | 'admin' | 'system';
export type UserStatus = 'active' | 'blocked' | 'deleted';

/** docs/database.md §2 users */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32, unique: true, nullable: true })
  @Index()
  phone: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  phoneVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  googleId: string | null;

  /** passwordless за замовчуванням — nullable */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: ['user', 'moderator', 'admin', 'system'], default: 'user' })
  role: UserRole;

  @Column({ type: 'enum', enum: ['active', 'blocked', 'deleted'], default: 'active' })
  status: UserStatus;

  /** Заповнюється при soft-delete; використовується cleanup job'ом через 6 місяців (decisions.md DEC-04) */
  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastActiveAt: Date | null;

  /** null = типовий ліміт (SettingsService.getMaxActiveListingsPerUser); адмін підвищує вручну для довірених/пілотних продавців (docs/decisions.md DEC-05). */
  @Column({ type: 'int', nullable: true })
  maxActiveListingsOverride: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
