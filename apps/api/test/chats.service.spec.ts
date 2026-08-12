import { ChatsService } from '../src/modules/chat/chats.service';
import { ChatParticipant } from '../src/modules/chat/chat-participant.entity';
import { Chat } from '../src/modules/chat/chat.entity';
import { User } from '../src/modules/users/user.entity';
import { CHAT_MESSAGE_CREATED } from '../src/modules/chat/chat.events';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function mockQueryBuilder(rows: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {};
  const chain = ['where', 'andWhere', 'orderBy', 'addOrderBy', 'limit', 'set'];
  for (const method of chain) {
    qb[method] = jest.fn().mockReturnValue(qb);
  }
  qb.getMany = jest.fn().mockResolvedValue(rows);
  qb.execute = jest.fn().mockResolvedValue({ affected: rows.length });
  qb.update = jest.fn().mockReturnValue(qb);
  return qb;
}

function mockRepo(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => ({ createdAt: new Date(), ...entity })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn(() => mockQueryBuilder()),
  };
}

async function expectHttpError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`expected promise to reject with code ${code}`);
  } catch (err) {
    expect((err as { getResponse: () => { code: string } }).getResponse().code).toBe(code);
  }
}

describe('ChatsService', () => {
  let chats: MockRepo;
  let participants: MockRepo;
  let messages: MockRepo;
  let users: MockRepo;
  let listings: MockRepo;
  let events: { emit: jest.Mock };
  let rateLimit: { consume: jest.Mock };
  let service: ChatsService;

  beforeEach(() => {
    chats = mockRepo();
    participants = mockRepo();
    messages = mockRepo();
    users = mockRepo();
    listings = mockRepo();
    events = { emit: jest.fn() };
    rateLimit = { consume: jest.fn().mockResolvedValue(undefined) };

    users.findOne.mockResolvedValue({ id: 'other', deletedAt: null } as User);

    service = new ChatsService(
      chats as never,
      participants as never,
      messages as never,
      users as never,
      listings as never,
      events as never,
      rateLimit as never,
    );
  });

  describe('findOrCreate', () => {
    it('кидає CHAT_CANNOT_MESSAGE_SELF, якщо otherUserId дорівнює userId', async () => {
      await expectHttpError(service.findOrCreate('u-1', { otherUserId: 'u-1' }), 'CHAT_CANNOT_MESSAGE_SELF');
    });

    it('кидає USER_NOT_FOUND для неіснуючого співрозмовника', async () => {
      users.findOne.mockResolvedValue(null);

      await expectHttpError(service.findOrCreate('u-1', { otherUserId: 'missing' }), 'USER_NOT_FOUND');
    });

    it('кидає LISTING_NOT_FOUND, якщо listingId вказано, але оголошення немає', async () => {
      listings.findOne.mockResolvedValue(null);

      await expectHttpError(
        service.findOrCreate('u-1', { otherUserId: 'other', listingId: 'missing' }),
        'LISTING_NOT_FOUND',
      );
    });

    it('повертає існуючий чат, якщо такий вже є між цими двома учасниками', async () => {
      participants.find
        .mockResolvedValueOnce([{ chatId: 'chat-1', userId: 'u-1' } as ChatParticipant]) // myParticipations
        .mockResolvedValueOnce([]); // не використовується напряму — findOne нижче вирішує
      chats.find.mockResolvedValue([{ id: 'chat-1', listingId: null } as Chat]);
      participants.findOne.mockResolvedValue({ chatId: 'chat-1', userId: 'other' } as ChatParticipant);

      const result = await service.findOrCreate('u-1', { otherUserId: 'other' });

      expect(result.id).toBe('chat-1');
      expect(chats.save).not.toHaveBeenCalled();
    });

    it('створює новий чат і двох учасників, якщо збігу немає', async () => {
      participants.find.mockResolvedValue([]);

      const result = await service.findOrCreate('u-1', { otherUserId: 'other' });

      expect(chats.save).toHaveBeenCalled();
      expect(participants.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 'u-1' }),
        expect.objectContaining({ userId: 'other' }),
      ]);
      expect(result).toBeDefined();
    });
  });

  describe('listChats', () => {
    it('повертає порожній список без запитів до chats, якщо участей немає', async () => {
      participants.find.mockResolvedValue([]);

      const result = await service.listChats('u-1');

      expect(result).toEqual([]);
      expect(chats.find).not.toHaveBeenCalled();
    });

    it('сортує за lastMessageAt DESC і підставляє otherUserId', async () => {
      participants.find
        .mockResolvedValueOnce([
          { chatId: 'c-old', userId: 'u-1', unreadCount: 0 } as ChatParticipant,
          { chatId: 'c-new', userId: 'u-1', unreadCount: 2 } as ChatParticipant,
        ])
        .mockResolvedValueOnce([
          { chatId: 'c-old', userId: 'u-1' } as ChatParticipant,
          { chatId: 'c-old', userId: 'partner-old' } as ChatParticipant,
          { chatId: 'c-new', userId: 'u-1' } as ChatParticipant,
          { chatId: 'c-new', userId: 'partner-new' } as ChatParticipant,
        ]);
      chats.find.mockResolvedValue([
        { id: 'c-old', listingId: null, lastMessageAt: new Date('2026-01-01') } as Chat,
        { id: 'c-new', listingId: null, lastMessageAt: new Date('2026-06-01') } as Chat,
      ]);

      const result = await service.listChats('u-1');

      expect(result[0].chatId).toBe('c-new');
      expect(result[0].otherUserId).toBe('partner-new');
      expect(result[1].chatId).toBe('c-old');
    });
  });

  describe('getMessages', () => {
    it('кидає CHAT_NOT_FOUND, якщо користувач не учасник', async () => {
      participants.findOne.mockResolvedValue(null);

      await expectHttpError(service.getMessages('stranger', 'chat-1'), 'CHAT_NOT_FOUND');
    });

    it('скидає unreadCount і lastReadAt після читання', async () => {
      const participant = { chatId: 'chat-1', userId: 'u-1', unreadCount: 5, lastReadAt: null } as ChatParticipant;
      participants.findOne.mockResolvedValue(participant);
      messages.createQueryBuilder.mockReturnValue(mockQueryBuilder([]));

      await service.getMessages('u-1', 'chat-1');

      expect(participant.unreadCount).toBe(0);
      expect(participant.lastReadAt).not.toBeNull();
      expect(participants.save).toHaveBeenCalledWith(participant);
    });
  });

  describe('sendMessage', () => {
    it('перевіряє rate limit (60/хв) перед надсиланням', async () => {
      rateLimit.consume.mockRejectedValue(new Error('RATE_LIMIT_EXCEEDED'));

      await expect(service.sendMessage('u-1', 'chat-1', 'привіт')).rejects.toThrow('RATE_LIMIT_EXCEEDED');

      expect(rateLimit.consume).toHaveBeenCalledWith('ratelimit:chat_message:u-1', 60, 60);
      expect(messages.save).not.toHaveBeenCalled();
    });

    it('кидає CHAT_BLOCKED, якщо власного учасника заблоковано', async () => {
      participants.findOne.mockResolvedValue({ chatId: 'chat-1', userId: 'u-1', isBlockedByOther: true } as ChatParticipant);

      await expectHttpError(service.sendMessage('u-1', 'chat-1', 'привіт'), 'CHAT_BLOCKED');
    });

    it('зберігає повідомлення, оновлює chat.lastMessageAt і емітить подію для отримувачів', async () => {
      participants.findOne.mockResolvedValue({ chatId: 'chat-1', userId: 'u-1', isBlockedByOther: false } as ChatParticipant);
      participants.find.mockResolvedValue([
        { chatId: 'chat-1', userId: 'u-1' } as ChatParticipant,
        { chatId: 'chat-1', userId: 'other' } as ChatParticipant,
      ]);

      const result = await service.sendMessage('u-1', 'chat-1', 'привіт');

      expect(result.text).toBe('привіт');
      expect(chats.update).toHaveBeenCalledWith({ id: 'chat-1' }, expect.objectContaining({ lastMessageAt: expect.any(Date) }));
      expect(events.emit).toHaveBeenCalledWith(
        CHAT_MESSAGE_CREATED,
        expect.objectContaining({ recipientUserIds: ['other'] }),
      );
    });
  });

  describe('block', () => {
    it('блокує лише ІНШИХ учасників, не самого користувача', async () => {
      participants.findOne.mockResolvedValue({ chatId: 'chat-1', userId: 'u-1' } as ChatParticipant);
      const other = { chatId: 'chat-1', userId: 'other', isBlockedByOther: false } as ChatParticipant;
      const me = { chatId: 'chat-1', userId: 'u-1', isBlockedByOther: false } as ChatParticipant;
      participants.find.mockResolvedValue([me, other]);

      await service.block('u-1', 'chat-1');

      expect(other.isBlockedByOther).toBe(true);
      expect(me.isBlockedByOther).toBe(false);
      expect(participants.save).toHaveBeenCalledWith([other]);
    });
  });
});
