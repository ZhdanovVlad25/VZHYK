import { LoggerService, LogLevel } from '@nestjs/common';

/**
 * Один JSON-рядок на подію в stdout — щоб лог-колектор (docs/deployment.md §6) міг
 * парсити без regex по кольоровому Nest-форматуванню. Використовується лише коли
 * NODE_ENV=production (main.ts) — у dev лишається звичний кольоровий Nest-логер.
 */
export class JsonLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  private write(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    // Nest передає [context] або [trace, context] в optionalParams залежно від виклику —
    // останній елемент завжди контекст (клас/модуль), решта (якщо є) — stack trace.
    const context =
      optionalParams.length > 0
        ? optionalParams[optionalParams.length - 1]
        : undefined;
    const trace =
      optionalParams.length > 1
        ? optionalParams.slice(0, -1).join(' ')
        : undefined;

    process.stdout.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        context,
        message:
          typeof message === 'string' ? message : JSON.stringify(message),
        ...(trace ? { trace } : {}),
      })}\n`,
    );
  }
}
