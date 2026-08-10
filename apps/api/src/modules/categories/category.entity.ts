import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** docs/database.md §2 categories. Unique (parent_id, slug), soft-delete через deletedAt. */
@Entity('categories')
@Index(['parentId', 'slug'], { unique: true })
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'RESTRICT' })
  parent: Category | null;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'varchar', length: 120 })
  nameUk: string;

  @Column({ type: 'varchar', length: 140 })
  slug: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  icon: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** 0 = root (Category), 1 = Subcategory, 2 = Sub-subcategory */
  @Column({ type: 'smallint', default: 0 })
  level: number;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
