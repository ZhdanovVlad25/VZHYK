import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../users/user.entity';

/**
 * docs/database.md §2 chat_participants, unique (chat_id, user_id).
 * isBlockedByOther — заблокований ІНШИМ учасником (не власна дія блокування).
 */
@Entity('chat_participants')
@Index(['chatId', 'userId'], { unique: true })
export class ChatParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat: Chat;

  @Column({ type: 'uuid' })
  chatId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'int', default: 0 })
  unreadCount: number;

  @Column({ type: 'boolean', default: false })
  isBlockedByOther: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;
}
