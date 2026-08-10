import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Category } from '../categories/category.entity';
import { Location } from '../location/location.entity';

/**
 * docs/database.md §2 saved_searches, docs/api.md §8.
 * lastNotifiedAt лишається null у цьому зрізі — двигуна зіставлення нових оголошень
 * зі збереженим пошуком ще немає (roadmap "Після MVP": сповіщення про збіг).
 */
@Entity('saved_searches')
@Index(['userId'])
export class SavedSearch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  queryText: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @Column({ type: 'uuid', nullable: true })
  categoryId: string | null;

  /** Решта фільтрів пошуку (priceMin/priceMax/condition/hasPhoto/sort тощо) — довільний JSON. */
  @Column({ type: 'jsonb', nullable: true })
  filters: Record<string, unknown> | null;

  @ManyToOne(() => Location, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'regionLocationId' })
  regionLocation: Location | null;

  @Column({ type: 'uuid', nullable: true })
  regionLocationId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastNotifiedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
