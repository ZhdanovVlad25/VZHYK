import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Listing } from './listing.entity';
import { CategoryAttribute } from '../attributes/category-attribute.entity';

/**
 * docs/database.md §2 listing_attribute_values. DEC-06 — єдина JSONB-колонка `value`
 * з валідацією проти category_attributes.data_type на рівні застосунку (ListingsService).
 */
@Entity('listing_attribute_values')
@Index(['listingId', 'categoryAttributeId'], { unique: true })
export class ListingAttributeValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  listing: Listing;

  @Column({ type: 'uuid' })
  listingId: string;

  @ManyToOne(() => CategoryAttribute, { onDelete: 'CASCADE' })
  categoryAttribute: CategoryAttribute;

  @Column({ type: 'uuid' })
  categoryAttributeId: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
