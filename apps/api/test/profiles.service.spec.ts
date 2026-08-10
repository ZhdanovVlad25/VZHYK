import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { Profile } from '../src/modules/profiles/profile.entity';
import { User } from '../src/modules/users/user.entity';

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

async function expectHttpError(promise: Promise<unknown>, code: string) {
  try {
    await promise;
    throw new Error(`expected promise to reject with code ${code}`);
  } catch (err) {
    expect((err as { getResponse: () => { code: string } }).getResponse().code).toBe(code);
  }
}

describe('ProfilesService', () => {
  let profiles: MockRepo;
  let users: MockRepo;
  let locations: MockRepo;
  let service: ProfilesService;

  beforeEach(() => {
    profiles = mockRepo();
    users = mockRepo();
    locations = mockRepo();
    service = new ProfilesService(profiles as never, users as never, locations as never);
  });

  describe('getOrCreateOwn', () => {
    it('повертає існуючий профіль, якщо він є', async () => {
      const existing = { id: 'p-1', userId: 'u-1' } as Profile;
      profiles.findOne.mockResolvedValue(existing);

      const result = await service.getOrCreateOwn('u-1');

      expect(result).toBe(existing);
      expect(profiles.save).not.toHaveBeenCalled();
    });

    it('lazy-створює профіль, якщо його ще немає', async () => {
      profiles.findOne.mockResolvedValue(null);

      const result = await service.getOrCreateOwn('u-1');

      expect(result.userId).toBe('u-1');
      expect(profiles.save).toHaveBeenCalled();
    });
  });

  describe('updateOwn', () => {
    it('кидає PROFILE_USERNAME_TAKEN, якщо username зайнятий іншим профілем', async () => {
      profiles.findOne
        .mockResolvedValueOnce({ id: 'p-1', userId: 'u-1', username: 'old' } as Profile)
        .mockResolvedValueOnce({ id: 'p-2', username: 'taken' } as Profile);

      await expectHttpError(service.updateOwn('u-1', { username: 'taken' }), 'PROFILE_USERNAME_TAKEN');
    });

    it('дозволяє залишити свій же username без конфлікту', async () => {
      profiles.findOne.mockResolvedValue({ id: 'p-1', userId: 'u-1', username: 'me' } as Profile);

      const result = await service.updateOwn('u-1', { username: 'me', displayName: 'Іван' });

      expect(result.displayName).toBe('Іван');
    });

    it('кидає LOCATION_NOT_FOUND для неіснуючої локації', async () => {
      profiles.findOne.mockResolvedValue({ id: 'p-1', userId: 'u-1' } as Profile);
      locations.findOne.mockResolvedValue(null);

      await expectHttpError(service.updateOwn('u-1', { cityLocationId: 'missing' }), 'LOCATION_NOT_FOUND');
    });
  });

  describe('getPublicProfile', () => {
    it('кидає USER_NOT_FOUND для неіснуючого користувача', async () => {
      users.findOne.mockResolvedValue(null);

      await expectHttpError(service.getPublicProfile('missing'), 'USER_NOT_FOUND');
    });

    it('повертає дефолтний публічний профіль без створення рядка в БД', async () => {
      users.findOne.mockResolvedValue({ id: 'u-1', createdAt: new Date('2026-01-01') } as User);
      profiles.findOne.mockResolvedValue(null);

      const result = await service.getPublicProfile('u-1');

      expect(result.displayName).toBeNull();
      expect(result.activeListingsCount).toBe(0);
      expect(profiles.save).not.toHaveBeenCalled();
    });

    it('не витікає phone/email — повертає лише публічні поля Profile', async () => {
      users.findOne.mockResolvedValue({ id: 'u-1', createdAt: new Date('2026-01-01') } as User);
      profiles.findOne.mockResolvedValue({
        displayName: 'Іван',
        username: 'ivan',
        rating: 4.5,
      } as Profile);

      const result = await service.getPublicProfile('u-1');

      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('email');
      expect(result.displayName).toBe('Іван');
    });
  });
});
