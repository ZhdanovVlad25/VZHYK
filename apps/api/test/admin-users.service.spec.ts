import { AdminUsersService } from '../src/modules/users/admin-users.service';
import { User } from '../src/modules/users/user.entity';

type MockRepo = { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };

describe('AdminUsersService', () => {
  let users: MockRepo;
  let auditLog: { record: jest.Mock };
  let service: AdminUsersService;

  beforeEach(() => {
    users = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn(async (e) => e) };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AdminUsersService(users as never, auditLog as never);
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
});
