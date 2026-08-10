import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/shared/filters/all-exceptions.filter';

function mockHost(headers: Record<string, string> = {}) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { headers };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  it('формує єдиний error envelope { error: { code, message, details, traceId } }', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, json } = mockHost();

    filter.catch(
      new BadRequestException({ code: 'OTP_INVALID', message: 'Невірний код' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    const payload = json.mock.calls[0][0];
    expect(payload.error.code).toBe('OTP_INVALID');
    expect(payload.error.message).toBe('Невірний код');
    expect(typeof payload.error.traceId).toBe('string');
  });

  it('використовує x-trace-id з заголовка запиту, якщо він переданий', () => {
    const filter = new AllExceptionsFilter();
    const { host, json } = mockHost({ 'x-trace-id': 'trace-123' });

    filter.catch(new BadRequestException('bad'), host);

    expect(json.mock.calls[0][0].error.traceId).toBe('trace-123');
  });
});
