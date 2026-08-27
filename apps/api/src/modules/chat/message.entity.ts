import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Chat } from './chat.entity';
import { User } from '../users/user.entity';

/**
 * docs/database.md §2 messages — append-only. mediaIds збережено в схемі per docs, але
 * в цьому зрізі завжди порожній масив: чат-специфічного upload-ендпоінта для фото ще
 * немає (Media зараз прив'язаний лише до /listings/:id/media) — текстові повідомлення MVP.
 */
@Entity('messages')
@Index(['chatId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Chat, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chatId' })
  chat: Chat;

  @Column({ type: 'uuid' })
  chatId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ type: 'uuid' })
  senderId: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'uuid', array: true, default: () => 'ARRAY[]::uuid[]' })
  mediaIds: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  /** Антифрод-сигнал (external-contact-detector.ts) — текст згадує Telegram/Viber/WhatsApp тощо. */
  @Column({ type: 'boolean', default: false })
  containsExternalContact: boolean;
}
