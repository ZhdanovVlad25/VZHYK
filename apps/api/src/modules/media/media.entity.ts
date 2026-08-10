import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Listing } from '../listings/listing.entity';
import { User } from '../users/user.entity';
import { MEDIA_MODERATION_STATUSES, MediaModerationStatus } from './media.constants';

/**
 * docs/database.md §2 media. listingId nullable — медіа може належати chat message
 * (Phase 3, ще не реалізовано); у цьому зрізі заповнюється лише для оголошень.
 * width/height не обчислюються в цьому зрізі (немає image-processing кроку —
 * див. коментар у ListingsService.publish() щодо аналогічного Phase 4 TODO).
 */
@Entity('media')
@Index(['listingId'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Listing, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing | null;

  @Column({ type: 'uuid', nullable: true })
  listingId: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerUserId' })
  owner: User;

  @Column({ type: 'uuid' })
  ownerUserId: string;

  @Column({ type: 'varchar', length: 500 })
  storageKey: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'boolean', default: false })
  isMain: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'enum', enum: MEDIA_MODERATION_STATUSES, default: 'PENDING' })
  moderationStatus: MediaModerationStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
