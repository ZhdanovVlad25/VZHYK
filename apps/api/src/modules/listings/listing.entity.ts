import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';
import { Location } from '../location/location.entity';
import {
  LISTING_CONDITIONS,
  LISTING_CURRENCIES,
  LISTING_STATUSES,
  LISTING_TYPES,
  ListingCondition,
  ListingCurrency,
  ListingStatus,
  ListingType,
} from './listing.constants';

/** Numeric-колонки Postgres повертаються як string через pg-driver — приводимо до number. */
const numericTransformer = {
  to: (value?: number | null) => value ?? null,
  from: (value?: string | null) => (value === null || value === undefined ? null : parseFloat(value)),
};

/**
 * docs/database.md §2 listings, docs/architecture.md §6 State Machine.
 * Optimistic locking через VersionColumn (docs/database.md §3) — конкурентні
 * редагування того самого оголошення відхиляються з LISTING_CONFLICT.
 */
@Entity('listings')
@Index(['categoryId', 'status', 'publishedAt'])
@Index(['userId', 'status'])
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  category: Category;

  @Column({ type: 'uuid' })
  categoryId: string;

  @Column({ type: 'enum', enum: LISTING_TYPES })
  listingType: ListingType;

  @Column({ type: 'varchar', length: 140 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true, transformer: numericTransformer })
  price: number | null;

  @Column({ type: 'enum', enum: LISTING_CURRENCIES, default: 'UAH' })
  currency: ListingCurrency;

  @Column({ type: 'boolean', default: false })
  isNegotiable: boolean;

  @Column({ type: 'enum', enum: LISTING_CONDITIONS, nullable: true })
  condition: ListingCondition | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: 'RESTRICT' })
  location: Location | null;

  @Column({ type: 'uuid', nullable: true })
  locationId: string | null;

  @Column({ type: 'enum', enum: LISTING_STATUSES, default: 'DRAFT' })
  status: ListingStatus;

  @Column({ type: 'int', default: 0 })
  viewsCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
