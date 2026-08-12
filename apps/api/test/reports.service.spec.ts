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
  let risk: { checkHighReportCount: jest.Mock };
  let auditLog: { record: jest.Mock };
  let rateLimit: { consume: jest.Mock };
  let service: ReportsService;

  beforeEach(() => {
    reports = mockRepo();
    listings = mockRepo();
    users = mockRepo();
    chatParticipants = mockRepo();
    risk = { checkHighReportCount: jest.fn().mockResolvedValue(undefined) };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    rateLimit = { consume: jest.fn().mockResolvedValue(undefined) };
    service = new ReportsService(
      reports as never,
      listings as never,
      users as never,
      chatParticipants as never,
      risk as never,
      auditLog as never,
      rateLimit as never,
    );
  });

  describe('create — rate limit', () => {
    it('перевіряє rate limit (10/добу) перед перевіркою існування цілі', async () => {
      rateLimit.consume.mockRejectedValue(new Error('RATE_LIMIT_EXCEEDED'));

      await expect(
        service.create('u-1', { targetType: 'LISTING', targetId: 'l-1', reason: 'SPAM' }),
      ).rejects.toThrow('RATE_LIMIT_EXCEEDED');

      expect(rateLimit.consume).toHaveBeenCalledWith('ratelimit:report_create:u-1', 10, 86_400);
      expect(listings.findOne).not.toHaveBeenCalled();
      expect(reports.save).not.toHaveBeenCalled();
    });
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
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner-1', deletedAt: null } as Listing);

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

    it('перевіряє RiskService.checkHighReportCount для власника оголошення, не репортера', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', userId: 'owner-1', deletedAt: null } as Listing);

      await service.create('u-1', { targetType: 'LISTING', targetId: 'l-1', reason: 'FRAUD' });

      expect(risk.checkHighReportCount).toHaveBeenCalledWith('owner-1');
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
      expect(risk.checkHighReportCount).toHaveBeenCalledWith('u-2');
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
      expect(risk.checkHighReportCount).not.toHaveBeenCalled();
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

  describe('adminList', () => {
    it('без фільтрів повертає всі, найновіші спочатку, take 100', async () => {
      await service.adminList();

      expect(reports.find).toHaveBeenCalledWith({ where: {}, order: { createdAt: 'DESC' }, take: 100 });
    });

    it('фільтрує за статусом (нормалізує регістр)', async () => {
      await service.adminList('pending');

      expect(reports.find).toHaveBeenCalledWith({ where: { status: 'PENDING' }, order: { createdAt: 'DESC' }, take: 100 });
    });

    it('кидає REPORT_STATUS_INVALID для невідомого статусу', async () => {
      await expect(service.adminList('bogus')).rejects.toMatchObject({ response: { code: 'REPORT_STATUS_INVALID' } });
    });

    it('фільтрує за targetType', async () => {
      await service.adminList(undefined, 'user');

      expect(reports.find).toHaveBeenCalledWith({ where: { targetType: 'USER' }, order: { createdAt: 'DESC' }, take: 100 });
    });

    it('кидає REPORT_TARGET_TYPE_INVALID для невідомого типу цілі', async () => {
      await expect(service.adminList(undefined, 'bogus')).rejects.toMatchObject({
        response: { code: 'REPORT_TARGET_TYPE_INVALID' },
      });
    });
  });

  describe('resolve', () => {
    it('кидає REPORT_NOT_FOUND для неіснуючої скарги', async () => {
      reports.findOne.mockResolvedValue(null);

      await expect(service.resolve('mod-1', 'missing', 'RESOLVED', null)).rejects.toMatchObject({
        response: { code: 'REPORT_NOT_FOUND' },
      });
    });

    it('кидає REPORT_ALREADY_DECIDED, якщо скарга вже RESOLVED/REJECTED', async () => {
      reports.findOne.mockResolvedValue({ id: 'r-1', status: 'RESOLVED' });

      await expect(service.resolve('mod-1', 'r-1', 'REJECTED', null)).rejects.toMatchObject({
        response: { code: 'REPORT_ALREADY_DECIDED' },
      });
    });

    it('оновлює статус і пише audit log з before/after', async () => {
      reports.findOne.mockResolvedValue({ id: 'r-1', status: 'PENDING' });

      const result = await service.resolve('mod-1', 'r-1', 'RESOLVED', '127.0.0.1');

      expect(result.status).toBe('RESOLVED');
      expect(auditLog.record).toHaveBeenCalledWith({
        actorUserId: 'mod-1',
        action: 'report.resolve',
        targetType: 'report',
        targetId: 'r-1',
        before: { status: 'PENDING' },
        after: { status: 'RESOLVED' },
        ip: '127.0.0.1',
      });
    });
  });
});
