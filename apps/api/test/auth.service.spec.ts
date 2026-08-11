import { AuthService } from '../src/modules/auth/auth.service';
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

describe('AuthService.loginWithGoogle', () => {
  let users: MockRepo;
  let otpCodes: MockRepo;
  let jwt: { signAsync: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    users = mockRepo();
    otpCodes = mockRepo();
    jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    service = new AuthService(users as never, otpCodes as never, jwt as never);
  });

  it('логінить існуючого користувача за googleId', async () => {
    const existing = { id: 'u-1', googleId: 'g-1', email: 'a@b.com', role: 'user', phone: null } as User;
    users.findOne.mockResolvedValueOnce(existing);

    const result = await service.loginWithGoogle({ googleId: 'g-1', email: 'a@b.com', displayName: 'A' });

    expect(users.findOne).toHaveBeenCalledWith({ where: { googleId: 'g-1' } });
    expect(users.save).not.toHaveBeenCalled();
    expect(result.user).toMatchObject({ id: 'u-1', role: 'user' });
  });

  it('прив’язує googleId до існуючого акаунту за email, якщо googleId ще не збігається', async () => {
    const existingByEmail = { id: 'u-2', googleId: null, email: 'a@b.com', role: 'user', phone: '+380...' } as User;
    users.findOne.mockResolvedValueOnce(null); // за googleId не знайдено
    users.findOne.mockResolvedValueOnce(existingByEmail); // за email знайдено

    const result = await service.loginWithGoogle({ googleId: 'g-new', email: 'a@b.com', displayName: 'A' });

    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ googleId: 'g-new', email: 'a@b.com' }));
    expect(result.user.id).toBe('u-2');
  });

  it('створює нового OAuth-only користувача, якщо немає ні googleId, ні email-збігу', async () => {
    users.findOne.mockResolvedValueOnce(null);
    users.findOne.mockResolvedValueOnce(null);

    await service.loginWithGoogle({ googleId: 'g-3', email: 'new@x.com', displayName: 'New' });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ googleId: 'g-3', email: 'new@x.com', role: 'user', status: 'active' }),
    );
  });

  it('створює нового користувача без запиту за email, якщо Google не повернув email', async () => {
    users.findOne.mockResolvedValueOnce(null);

    await service.loginWithGoogle({ googleId: 'g-4', email: null, displayName: null });

    expect(users.findOne).toHaveBeenCalledTimes(1);
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ googleId: 'g-4', email: null }));
  });

  it('видає accessToken/refreshToken через issueTokens', async () => {
    users.findOne.mockResolvedValueOnce({ id: 'u-1', role: 'user', phone: null } as User);

    const result = await service.loginWithGoogle({ googleId: 'g-1', email: null, displayName: null });

    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);
  });
});
