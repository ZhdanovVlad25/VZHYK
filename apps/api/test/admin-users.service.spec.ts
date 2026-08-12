import { AdminUsersService } from '../src/modules/users/admin-users.service';
import { User } from '../src/modules/users/user.entity';

type MockRepo = { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };

function mockRepo(): MockRepo {
  return { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn(async (e) => e) };
}

describe('AdminUsersService', () => {
  let users: MockRepo;
  let listings: MockRepo;
  let reports: MockRepo;
  let riskSignals: MockRepo;
  let riskScores: MockRepo;
  let auditLog: { record: jest.Mock };
  let profiles: { getPublicProfile: jest.Mock };
  let service: AdminUsersService;

  beforeEach(() => {
    users = mockRepo();
    listings = mockRepo();
    reports = mockRepo();
    riskSignals = mockRepo();
    riskScores = mockRepo();
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    profiles = { getPublicProfile: jest.fn().mockResolvedValue({ userId: 'u-2', displayName: null }) };
    service = new AdminUsersService(
      users as never,
      listings as never,
      reports as never,
      riskSignals as never,
      riskScores as never,
      auditLog as never,
      profiles as never,
    );
  });

  describe('search', () => {
    it('шукає за phone/email через ILIKE, коли передано query', async () => {
      await service.search('067');

      expect(users.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.arrayContaining([expect.anything(), expect.anything()]) }),
      );
    });

    it('повертає усіх (обмежено 50), коли query не передано', async () => {
      await service.search(undefined);

      expect(users.find).toHaveBeenCalledWith(expect.objectContaining({ where: {}, take: 50 }));
    });
  });

  describe('block', () => {
    it('кидає USER_CANNOT_SELF_BLOCK при спробі заблокувати самого себе', async () => {
      await expect(service.block('u-1', 'u-1', null)).rejects.toMatchObject({
        response: { code: 'USER_CANNOT_SELF_BLOCK' },
      });
      expect(users.findOne).not.toHaveBeenCalled();
    });

    it('кидає USER_NOT_FOUND для неіснуючого користувача', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(service.block('admin-1', 'missing', null)).rejects.toMatchObject({
        response: { code: 'USER_NOT_FOUND' },
      });
    });

    it('переводить користувача в blocked і пише audit log', async () => {
      users.findOne.mockResolvedValue({ id: 'u-2', status: 'active', phone: '+380...', email: null, role: 'user' } as User);

      const result = await service.block('admin-1', 'u-2', '10.0.0.1');

      expect(result.status).toBe('blocked');
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          action: 'user.block',
          targetType: 'user',
          targetId: 'u-2',
          before: { status: 'active' },
          after: { status: 'blocked' },
          ip: '10.0.0.1',
        }),
      );
    });
  });

  describe('unblock', () => {
    it('переводить користувача назад у active і пише audit log', async () => {
      users.findOne.mockResolvedValue({ id: 'u-2', status: 'blocked', phone: null, email: 'a@b.com', role: 'user' } as User);

      const result = await service.unblock('admin-1', 'u-2', null);

      expect(result.status).toBe('active');
      expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'user.unblock' }));
    });
  });

  describe('getDetail', () => {
    it('кидає USER_NOT_FOUND для неіснуючого користувача', async () => {
      users.findOne.mockResolvedValue(null);

      await expect(service.getDetail('missing')).rejects.toMatchObject({ response: { code: 'USER_NOT_FOUND' } });
    });

    it('збирає профіль/оголошення/risk-score/risk-сигнали', async () => {
      users.findOne.mockResolvedValue({
        id: 'u-2',
        phone: '+380...',
        email: null,
        role: 'user',
        status: 'active',
        createdAt: new Date('2026-01-01'),
      } as User);
      listings.find.mockResolvedValueOnce([{ id: 'l-1', title: 't', status: 'ACTIVE', price: 100, currency: 'UAH' }]);
      listings.find.mockResolvedValueOnce([{ id: 'l-1' }]);
      riskScores.findOne.mockResolvedValue({ userId: 'u-2', score: 13 });
      riskSignals.find.mockResolvedValue([{ id: 'rs-1', signalType: 'rapid_listing_creation', weight: 5 }]);
      reports.find.mockResolvedValue([{ id: 'r-1', targetType: 'LISTING', targetId: 'l-1', reason: 'SPAM', status: 'PENDING' }]);

      const result = await service.getDetail('u-2');

      expect(result.riskScore).toBe(13);
      expect(result.listings).toHaveLength(1);
      expect(result.riskSignals).toHaveLength(1);
      expect(result.reports).toHaveLength(1);
      expect(profiles.getPublicProfile).toHaveBeenCalledWith('u-2');
    });

    it('риск-скор 0, коли RiskScore-рядка ще нема', async () => {
      users.findOne.mockResolvedValue({ id: 'u-2', status: 'active' } as User);
      riskScores.findOne.mockResolvedValue(null);

      const result = await service.getDetail('u-2');

      expect(result.riskScore).toBe(0);
    });

    it('шукає скарги і за targetType USER, і за LISTING серед оголошень юзера', async () => {
      users.findOne.mockResolvedValue({ id: 'u-2', status: 'active' } as User);
      listings.find.mockResolvedValueOnce([]);
      listings.find.mockResolvedValueOnce([{ id: 'l-1' }, { id: 'l-2' }]);

      await service.getDetail('u-2');

      expect(reports.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            { targetType: 'USER', targetId: 'u-2' },
            expect.objectContaining({ targetType: 'LISTING' }),
          ]),
        }),
      );
    });
  });
});
