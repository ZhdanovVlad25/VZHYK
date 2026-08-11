import { AuditLogService } from '../src/modules/audit-log/audit-log.service';

type MockRepo = { find: jest.Mock; save: jest.Mock; create: jest.Mock };

describe('AuditLogService', () => {
  let logs: MockRepo;
  let service: AuditLogService;

  beforeEach(() => {
    logs = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (e) => e),
      create: jest.fn((e) => e),
    };
    service = new AuditLogService(logs as never);
  });

  describe('record', () => {
    it('зберігає запис з усіма полями', async () => {
      await service.record({
        actorUserId: 'u-1',
        action: 'user.block',
        targetType: 'user',
        targetId: 'u-2',
        before: { status: 'active' },
        after: { status: 'blocked' },
        ip: '1.2.3.4',
      });

      expect(logs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u-1',
          action: 'user.block',
          targetType: 'user',
          targetId: 'u-2',
          before: { status: 'active' },
          after: { status: 'blocked' },
          ip: '1.2.3.4',
        }),
      );
      expect(logs.save).toHaveBeenCalled();
    });

    it('підставляє null для необов’язкових полів', async () => {
      await service.record({ actorUserId: 'u-1', action: 'x', targetType: 'y' });

      expect(logs.create).toHaveBeenCalledWith(
        expect.objectContaining({ targetId: null, before: null, after: null, ip: null }),
      );
    });
  });

  describe('list', () => {
    it('повертає останні записи, новіші спочатку, обмежено 100', async () => {
      await service.list();

      expect(logs.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' }, take: 100 });
    });
  });
});
