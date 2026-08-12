import { AdminListingsService } from '../src/modules/listings/admin-listings.service';
import { Listing } from '../src/modules/listings/listing.entity';

type MockRepo = { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };

function mockRepo(): MockRepo {
  return { find: jest.fn().mockResolvedValue([]), findOne: jest.fn(), save: jest.fn(async (e) => e) };
}

describe('AdminListingsService', () => {
  let listings: MockRepo;
  let search: { index: jest.Mock; remove: jest.Mock };
  let auditLog: { record: jest.Mock };
  let service: AdminListingsService;

  beforeEach(() => {
    listings = mockRepo();
    search = { index: jest.fn().mockResolvedValue(undefined), remove: jest.fn().mockResolvedValue(undefined) };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AdminListingsService(listings as never, search as never, auditLog as never);
  });

  describe('search', () => {
    it('без фільтрів шукає лише не видалені, take 50', async () => {
      await service.search();

      expect(listings.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: expect.anything() }), take: 50 }),
      );
    });

    it('фільтрує за статусом (нормалізує регістр)', async () => {
      await service.search(undefined, 'active');

      expect(listings.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'ACTIVE' }) }),
      );
    });

    it('кидає LISTING_STATUS_INVALID для невідомого статусу', async () => {
      await expect(service.search(undefined, 'bogus')).rejects.toMatchObject({
        response: { code: 'LISTING_STATUS_INVALID' },
      });
    });
  });

  describe('update', () => {
    it('кидає LISTING_NOT_FOUND для неіснуючого оголошення', async () => {
      listings.findOne.mockResolvedValue(null);

      await expect(service.update('admin-1', 'missing', {}, null)).rejects.toMatchObject({
        response: { code: 'LISTING_NOT_FOUND' },
      });
    });

    it('блокує активне оголошення, знімає з пошукового індексу, пише audit log', async () => {
      listings.findOne.mockResolvedValue({
        id: 'l-1',
        status: 'ACTIVE',
        title: 't',
        description: null,
        price: 100,
        currency: 'UAH',
      } as Listing);

      const result = await service.update('admin-1', 'l-1', { status: 'BLOCKED' }, '10.0.0.1');

      expect(result.status).toBe('BLOCKED');
      expect(search.remove).toHaveBeenCalledWith('l-1');
      expect(search.index).not.toHaveBeenCalled();
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'admin-1',
          action: 'listing.admin_update',
          targetType: 'listing',
          targetId: 'l-1',
          before: expect.objectContaining({ status: 'ACTIVE' }),
          after: expect.objectContaining({ status: 'BLOCKED' }),
          ip: '10.0.0.1',
        }),
      );
    });

    it('кидає LISTING_ALREADY_BLOCKED при повторному блокуванні', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', status: 'BLOCKED', title: 't', description: null, price: 100, currency: 'UAH' });

      await expect(service.update('admin-1', 'l-1', { status: 'BLOCKED' }, null)).rejects.toMatchObject({
        response: { code: 'LISTING_ALREADY_BLOCKED' },
      });
    });

    it('розблоковує (BLOCKED -> ACTIVE) і повертає в пошуковий індекс', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', status: 'BLOCKED', title: 't', description: null, price: 100, currency: 'UAH' });

      const result = await service.update('admin-1', 'l-1', { status: 'ACTIVE' }, null);

      expect(result.status).toBe('ACTIVE');
      expect(search.index).toHaveBeenCalledWith('l-1');
    });

    it('кидає LISTING_NOT_BLOCKED при спробі "розблокувати" не заблоковане оголошення', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', status: 'ACTIVE', title: 't', description: null, price: 100, currency: 'UAH' });

      await expect(service.update('admin-1', 'l-1', { status: 'ACTIVE' }, null)).rejects.toMatchObject({
        response: { code: 'LISTING_NOT_BLOCKED' },
      });
    });

    it('оновлює контентні поля незалежно від статусу', async () => {
      listings.findOne.mockResolvedValue({ id: 'l-1', status: 'SOLD', title: 'old', description: null, price: 100, currency: 'UAH' });

      const result = await service.update('admin-1', 'l-1', { title: 'new title' }, null);

      expect(result.title).toBe('new title');
      expect(result.status).toBe('SOLD');
      expect(search.remove).not.toHaveBeenCalled();
      expect(search.index).not.toHaveBeenCalled();
    });
  });
});
