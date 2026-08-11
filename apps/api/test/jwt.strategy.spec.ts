import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { User } from '../src/modules/users/user.entity';

type MockRepo = { findOne: jest.Mock };

describe('JwtStrategy.validate', () => {
  let users: MockRepo;
  let config: { get: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    users = { findOne: jest.fn() };
    config = { get: jest.fn().mockReturnValue('dev_only_secret') };
    strategy = new JwtStrategy(config as never, users as never);
  });

  it('повертає AuthenticatedUser для активного користувача', async () => {
    users.findOne.mockResolvedValue({ id: 'u-1', status: 'active' } as User);

    const result = await strategy.validate({ sub: 'u-1', role: 'user', phone: '+380...' });

    expect(result).toEqual({ id: 'u-1', role: 'user', phone: '+380...' });
  });

  it('кидає USER_BLOCKED для заблокованого користувача', async () => {
    users.findOne.mockResolvedValue({ id: 'u-2', status: 'blocked' } as User);

    await expect(strategy.validate({ sub: 'u-2', role: 'user' })).rejects.toMatchObject({
      response: { code: 'USER_BLOCKED' },
    });
  });

  it('кидає USER_BLOCKED для видаленого користувача', async () => {
    users.findOne.mockResolvedValue({ id: 'u-3', status: 'deleted' } as User);

    await expect(strategy.validate({ sub: 'u-3', role: 'user' })).rejects.toMatchObject({
      response: { code: 'USER_BLOCKED' },
    });
  });

  it('кидає USER_BLOCKED, якщо користувача взагалі не існує (видалений акаунт, токен ще не сплив)', async () => {
    users.findOne.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 'gone', role: 'user' })).rejects.toMatchObject({
      response: { code: 'USER_BLOCKED' },
    });
  });
});
