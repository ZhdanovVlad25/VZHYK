import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** docs/database.md §2 otp_codes — код ніколи не зберігається у відкритому вигляді */
@Entity('otp_codes')
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  @Index()
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  codeHash: string;

  @Column({ type: 'enum', enum: ['login', 'verify'], default: 'login' })
  purpose: 'login' | 'verify';

  @Column({ type: 'int', default: 0 })
  attemptsCount: number;

  @Column({ type: 'int', default: 5 })
  maxAttempts: number;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  createdIp: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
