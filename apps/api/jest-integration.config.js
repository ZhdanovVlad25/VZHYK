module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.integration-spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 30_000,
  setupFiles: ['<rootDir>/test/integration/env-setup.ts'],
  globalSetup: '<rootDir>/test/integration/global-setup.ts',
  // Спільна тестова БД між файлами — паралельні jest-воркери гонялись би за одні й ті самі рядки.
  maxWorkers: 1,
  // NestJS/TypeORM/ioredis не завжди закривають усі handle на app.close() — без forceExit
  // Jest висить нескінченно після завершення тестів замість повернути exit code.
  forceExit: true,
};
