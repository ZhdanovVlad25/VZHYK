import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';

/**
 * docs/database.md §2 favorites, unique (user_id, listing_id).
 * priceSnapshot — ціна оголошення в момент додавання в обране; не входить у мінімальну
 * схему з database.md, але потрібна для прапорця "ціна змінилась" з docs/api.md §8.
 */
@Entity('favorites')
@Index(['userId', 'listingId'], { unique: true })
export class Favorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column({ type: 'uuid' })
  listingId: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value?: number | null) => value ?? null,
      from: (value?: string | null) => (value === null || value === undefined ? null : parseFloat(value)),
    },
  })
  priceSnapshot: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
