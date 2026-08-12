import { RateLimitService } from '../src/shared/rate-limit.service';

describe('RateLimitService', () => {
  let redis: { incr: jest.Mock; expire: jest.Mock };
  let service: RateLimitService;

  beforeEach(() => {
    redis = { incr: jest.fn(), expire: jest.fn().mockResolvedValue(undefined) };
    service = new RateLimitService(redis as never);
  });

  it('не кидає, коли лічильник у межах ліміту', async () => {
    redis.incr.mockResolvedValue(1);

    await expect(service.consume('key-1', 5, 60)).resolves.toBeUndefined();
  });

  it('виставляє TTL на перший хіт вікна (INCR повернув 1)', async () => {
    redis.incr.mockResolvedValue(1);

    await service.consume('key-1', 5, 60);

    expect(redis.expire).toHaveBeenCalledWith('key-1', 60);
  });

  it('НЕ перевиставляє TTL на наступних хітах у тому самому вікні', async () => {
    redis.incr.mockResolvedValue(2);

    await service.consume('key-1', 5, 60);

    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('кидає 429 RATE_LIMIT_EXCEEDED, коли лічильник перевищив ліміт', async () => {
    redis.incr.mockResolvedValue(6);

    await expect(service.consume('key-1', 5, 60)).rejects.toMatchObject({
      status: 429,
      response: { code: 'RATE_LIMIT_EXCEEDED' },
    });
  });

  it('не кидає рівно на межі ліміту', async () => {
    redis.incr.mockResolvedValue(5);

    await expect(service.consume('key-1', 5, 60)).resolves.toBeUndefined();
  });
});
