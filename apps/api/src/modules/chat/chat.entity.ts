import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Listing } from '../listings/listing.entity';

/** docs/database.md §2 chats. listingId nullable — чат може існувати без прив'язки до оголошення. */
@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Listing, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'listingId' })
  listing: Listing | null;

  @Column({ type: 'uuid', nullable: true })
  listingId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastMessageText: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
