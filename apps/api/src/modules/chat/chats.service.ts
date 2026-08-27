import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { In, IsNull, Repository } from 'typeorm';
import { Chat } from './chat.entity';
import { ChatParticipant } from './chat-participant.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { Listing } from '../listings/listing.entity';
import { CreateChatDto } from './dto/create-chat.dto';
import { CHAT_MESSAGE_CREATED } from './chat.events';
import { containsExternalContactMention } from './external-contact-detector';
import { decodeCursor, encodeCursor } from '../../shared/pagination/cursor';
import { RateLimitService } from '../../shared/rate-limit.service';

const MESSAGES_PAGE_LIMIT = 30;
const CHAT_MESSAGE_PER_MINUTE_LIMIT = 60; // docs/security.md §6

export interface ChatListItem {
  chatId: string;
  listingId: string | null;
  otherUserId: string | null;
  lastMessageAt: Date | null;
  lastMessageText: string | null;
  unreadCount: number;
}

export interface MessagesPage {
  items: Message[];
  nextCursor: string | null;
}

/** docs/api.md §9 Chat — REST-частина. Realtime push — ChatGateway через CHAT_MESSAGE_CREATED. */
@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat) private readonly chats: Repository<Chat>,
    @InjectRepository(ChatParticipant) private readonly participants: Repository<ChatParticipant>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    private readonly events: EventEmitter2,
    private readonly rateLimit: RateLimitService,
  ) {}

  async findOrCreate(userId: string, dto: CreateChatDto): Promise<Chat> {
    if (dto.otherUserId === userId) {
      throw new BadRequestException({ code: 'CHAT_CANNOT_MESSAGE_SELF', message: 'Не можна створити чат із самим собою' });
    }

    const otherUser = await this.users.findOne({ where: { id: dto.otherUserId, deletedAt: IsNull() } });
    if (!otherUser) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Користувача не знайдено' });
    }
    if (dto.listingId) {
      const listing = await this.listings.findOne({ where: { id: dto.listingId, deletedAt: IsNull() } });
      if (!listing) {
        throw new NotFoundException({ code: 'LISTING_NOT_FOUND', message: 'Оголошення не знайдено' });
      }
    }

    const myParticipations = await this.participants.find({ where: { userId } });
    if (myParticipations.length > 0) {
      const candidateChatIds = myParticipations.map((p) => p.chatId);
      const candidateChats = await this.chats.find({
        where: { id: In(candidateChatIds), listingId: dto.listingId ?? IsNull() },
      });
      for (const chat of candidateChats) {
        const otherParticipant = await this.participants.findOne({
          where: { chatId: chat.id, userId: dto.otherUserId },
        });
        if (otherParticipant) {
          return chat;
        }
      }
    }

    const chat = await this.chats.save(this.chats.create({ listingId: dto.listingId ?? null }));
    await this.participants.save([
      this.participants.create({ chatId: chat.id, userId }),
      this.participants.create({ chatId: chat.id, userId: dto.otherUserId }),
    ]);
    return chat;
  }

  async listChats(userId: string): Promise<ChatListItem[]> {
    const myParticipations = await this.participants.find({ where: { userId } });
    if (myParticipations.length === 0) {
      return [];
    }

    const chatIds = myParticipations.map((p) => p.chatId);
    const [chats, allParticipants] = await Promise.all([
      this.chats.find({ where: { id: In(chatIds) } }),
      this.participants.find({ where: { chatId: In(chatIds) } }),
    ]);
    const chatById = new Map(chats.map((c) => [c.id, c]));
    const otherUserByChatId = new Map<string, string>();
    for (const p of allParticipants) {
      if (p.userId !== userId) {
        otherUserByChatId.set(p.chatId, p.userId);
      }
    }

    return myParticipations
      .map((p) => ({
        chatId: p.chatId,
        listingId: chatById.get(p.chatId)?.listingId ?? null,
        otherUserId: otherUserByChatId.get(p.chatId) ?? null,
        lastMessageAt: chatById.get(p.chatId)?.lastMessageAt ?? null,
        lastMessageText: chatById.get(p.chatId)?.lastMessageText ?? null,
        unreadCount: p.unreadCount,
      }))
      .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0));
  }

  async getMessages(userId: string, chatId: string, cursor?: string): Promise<MessagesPage> {
    const participant = await this.assertParticipant(userId, chatId);

    const qb = this.messages
      .createQueryBuilder('m')
      .where('m."chatId" = :chatId', { chatId })
      .orderBy('m."createdAt"', 'DESC')
      .addOrderBy('m."id"', 'DESC')
      .limit(MESSAGES_PAGE_LIMIT + 1);

    if (cursor) {
      const decoded = this.parseCursor(cursor);
      qb.andWhere('(m."createdAt", m."id") < (:cursorCreatedAt::timestamptz, :cursorId)', {
        cursorCreatedAt: decoded.v,
        cursorId: decoded.id,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > MESSAGES_PAGE_LIMIT;
    const page = hasMore ? rows.slice(0, MESSAGES_PAGE_LIMIT) : rows;

    let nextCursor: string | null = null;
    if (hasMore) {
      const last = page[page.length - 1];
      nextCursor = encodeCursor({ v: last.createdAt.toISOString(), id: last.id });
    }

    participant.unreadCount = 0;
    participant.lastReadAt = new Date();
    await this.participants.save(participant);

    return { items: page, nextCursor };
  }

  async sendMessage(userId: string, chatId: string, text: string): Promise<Message> {
    await this.rateLimit.consume(`ratelimit:chat_message:${userId}`, CHAT_MESSAGE_PER_MINUTE_LIMIT, 60);
    const participant = await this.assertParticipant(userId, chatId);
    if (participant.isBlockedByOther) {
      throw new ForbiddenException({ code: 'CHAT_BLOCKED', message: 'Вас заблоковано в цьому чаті' });
    }

    const message = await this.messages.save(
      this.messages.create({ chatId, senderId: userId, text, containsExternalContact: containsExternalContactMention(text) }),
    );
    await this.chats.update({ id: chatId }, { lastMessageAt: message.createdAt, lastMessageText: message.text });

    const others = await this.participants.find({ where: { chatId } });
    const recipientUserIds = others.filter((p) => p.userId !== userId).map((p) => p.userId);
    if (recipientUserIds.length > 0) {
      await this.participants
        .createQueryBuilder()
        .update(ChatParticipant)
        .set({ unreadCount: () => '"unreadCount" + 1' })
        .where('chatId = :chatId', { chatId })
        .andWhere('userId IN (:...ids)', { ids: recipientUserIds })
        .execute();
    }

    this.events.emit(CHAT_MESSAGE_CREATED, { message, recipientUserIds });
    return message;
  }

  async block(userId: string, chatId: string): Promise<void> {
    await this.assertParticipant(userId, chatId);
    const others = await this.participants.find({ where: { chatId } });
    const otherRows = others.filter((p) => p.userId !== userId);
    for (const row of otherRows) {
      row.isBlockedByOther = true;
    }
    await this.participants.save(otherRows);
  }

  private async assertParticipant(userId: string, chatId: string): Promise<ChatParticipant> {
    const participant = await this.participants.findOne({ where: { chatId, userId } });
    if (!participant) {
      // Не розкриваємо існування чату стороннім — той самий код і для "чату немає", і для "ви не учасник".
      throw new NotFoundException({ code: 'CHAT_NOT_FOUND', message: 'Чат не знайдено' });
    }
    return participant;
  }

  private parseCursor(raw: string) {
    try {
      return decodeCursor(raw);
    } catch {
      throw new BadRequestException({ code: 'CHAT_INVALID_CURSOR', message: 'Некоректний курсор пагінації' });
    }
  }
}
