/** Next.js instrumentation hook — реєструє Sentry лише для node runtime (edge не використовується, немає middleware.ts). */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}
