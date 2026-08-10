import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Listing } from './listing.entity';
import { LISTING_CURRENCIES, ListingCurrency } from './listing.constants';

const numericTransformer = {
  to: (value?: number | null) => value ?? null,
  from: (value?: string | null) => (value === null || value === undefined ? null : parseFloat(value)),
};

/** docs/database.md §1/§2 price_history — append-only, без soft-delete/updatedAt. */
@Entity('price_history')
@Index(['listingId'])
export class PriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing;

  @Column({ type: 'uuid' })
  listingId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
  oldPrice: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
  newPrice: number | null;

  @Column({ type: 'enum', enum: LISTING_CURRENCIES })
  currency: ListingCurrency;

  @CreateDateColumn({ type: 'timestamptz' })
  changedAt: Date;
}
