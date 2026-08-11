import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { MODERATION_CASE_STATUSES, ModerationCaseStatus } from './moderation.constants';

/** docs/api.md §12 Admin — черга модерації. Замінює авто-approve в ListingsService.publish(). */
@Entity('moderation_cases')
@Index(['listingId'])
export class ModerationCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column({ type: 'uuid' })
  listingId: string;

  @Column({ type: 'enum', enum: MODERATION_CASE_STATUSES, default: 'PENDING' })
  status: ModerationCaseStatus;

  @Column({ type: 'varchar', length: 200, nullable: true })
  autoFlagReason: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'moderatorId' })
  moderator: User | null;

  @Column({ type: 'uuid', nullable: true })
  moderatorId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
