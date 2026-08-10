import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type LocationLevel = 'country' | 'region' | 'city' | 'district';

/** docs/database.md §2 locations — seed: Україна → області → міста → райони */
@Entity('locations')
@Index(['parentId'])
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Location, { nullable: true, onDelete: 'RESTRICT' })
  parent: Location | null;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'enum', enum: ['country', 'region', 'city', 'district'] })
  level: LocationLevel;

  @Column({ type: 'varchar', length: 120 })
  nameUk: string;

  @Column({ type: 'varchar', length: 140 })
  slug: string;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
