import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * docs/database.md §2 profiles.
 * activeListingsCount — денормалізований лічильник, синхронізується при зміні listings.status,
 * використовується для enforcement ліміту 5 активних оголошень (decisions.md DEC-05).
 */
@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'uuid', nullable: true })
  avatarMediaId: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 60, unique: true, nullable: true })
  username: string | null;

  @Column({ type: 'uuid', nullable: true })
  cityLocationId: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true })
  rating: number | null;

  @Column({ type: 'int', nullable: true })
  reviewsCount: number | null;

  @Column({ type: 'int', default: 0 })
  activeListingsCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
