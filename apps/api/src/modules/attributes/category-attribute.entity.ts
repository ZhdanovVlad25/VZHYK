import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';

export type AttributeDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'multi_enum'
  | 'range';

/** docs/database.md §2 category_attributes */
@Entity('category_attributes')
@Index(['categoryId'])
export class CategoryAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  category: Category;

  @Column({ type: 'uuid' })
  categoryId: string;

  @Column({ type: 'varchar', length: 60 })
  key: string;

  @Column({ type: 'varchar', length: 120 })
  labelUk: string;

  @Column({
    type: 'enum',
    enum: ['string', 'number', 'boolean', 'enum', 'multi_enum', 'range'],
  })
  dataType: AttributeDataType;

  /** enum_options з опційним parent_key для залежних атрибутів (напр. model залежить від brand) */
  @Column({ type: 'jsonb', nullable: true })
  enumOptions: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ type: 'boolean', default: false })
  isFilterable: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
