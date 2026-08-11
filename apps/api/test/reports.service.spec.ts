import { ReportsService } from '../src/modules/reports/reports.service';
import { Listing } from '../src/modules/listings/listing.entity';
import { User } from '../src/modules/users/user.entity';
import { ChatParticipant } from '../src/modules/chat/chat-participant.entity';

type MockRepo = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
};

function mockRepo(): MockRepo {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    save: jest.fn(async (entity) => entity),
    create: jest.fn((entity) => entity),
  };
}

describe('ReportsService', () => {
  let reports: MockRepo;
  let listings: MockRepo;
  let users: MockRepo;
  let chatParticipants: MockRepo;
  let service: ReportsService;

  beforeEach(() => {
    reports = mockRepo();
    listings = mockRepo();
    users = mockRepo();
    chatParticipants = mockRepo();
    service = new ReportsService(reports as never, listings as never, users as never, chatParticipants as never);
  });

  describe('create — targetType LISTING', () => {
    it('кидає LISTING_NOT_FOUND для неіснуючого оголошення', async () => {
      listings.findOne.mockResolvedValue(null);

      await expect(
        service.create('u-1', { targetType: 'LISTING', targetId: 'missing', reason: 'SPAM' }),
      ).rejects.toMatchObject({ response: { code: 'LISTING_NOT_FOUND' } });
      expect(reports.save).not.toHaveBeenCalled();
    });

    it('створює скаргу зі статусом PENDING, коли оголошення існує', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', deletedAt: null } as Listing);

      const result = await service.create('u-1', {
        targetType: 'LISTING',
        targetId: 'l-1',
        reason: 'FRAUD',
        description: 'Схоже на шахрайство',
      });

      expect(result).toMatchObject({
        reporterId: 'u-1',
        targetType: 'LISTING',
        targetId: 'l-1',
        reason: 'FRAUD',
        description: 'Схоже на шахрайство',
      });
      expect(reports.save).toHaveBeenCalled();
    });
  });

  describe('create — targetType USER', () => {
    it('кидає USER_NOT_FOUND для неіснуючого користувача', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(
        service.create('u-1', { targetType: 'USER', targetId: 'missing', reason: 'OTHER' }),
      ).rejects.toMatchObject({ response: { code: 'USER_NOT_FOUND' } });
    });

    it('створює скаргу, коли користувач існує', async () => {
      users.findOne.mockResolvedValue({ id: 'u-2', deletedAt: null } as User);

      await service.create('u-1', { targetType: 'USER', targetId: 'u-2', reason: 'OFFENSIVE_CONTENT' });

      expect(reports.create).toHaveBeenCalledWith(
        expect.objectContaining({ reporterId: 'u-1', targetType: 'USER', targetId: 'u-2', reason: 'OFFENSIVE_CONTENT' }),
      );
    });
  });

  describe('create — targetType CHAT', () => {
    it('кидає CHAT_NOT_FOUND, якщо репортер не учасник чату (приховує існування)', async () => {
      chatParticipants.findOne.mockResolvedValue(null);

      await expect(
        service.create('u-1', { targetType: 'CHAT', targetId: 'chat-1', reason: 'SPAM' }),
      ).rejects.toMatchObject({ response: { code: 'CHAT_NOT_FOUND' } });
    });

    it('створює скаргу, коли репортер — учасник чату', async () => {
      chatParticipants.findOne.mockResolvedValue({ id: 'cp-1', chatId: 'chat-1', userId: 'u-1' } as ChatParticipant);

      const result = await service.create('u-1', { targetType: 'CHAT', targetId: 'chat-1', reason: 'DUPLICATE' });

      expect(result).toMatchObject({ targetType: 'CHAT', targetId: 'chat-1' });
    });
  });

  describe('list', () => {
    it('повертає лише скарги викликача, найновіші спочатку', async () => {
      const mine = [{ id: 'r-1', reporterId: 'u-1' }];
      reports.find.mockResolvedValue(mine);

      const result = await service.list('u-1');

      expect(result).toBe(mine);
      expect(reports.find).toHaveBeenCalledWith({ where: { reporterId: 'u-1' }, order: { createdAt: 'DESC' } });
    });
  });
});
