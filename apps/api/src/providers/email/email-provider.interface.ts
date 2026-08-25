/** Той самий патерн, що SmsProvider (docs/architecture.md §4) — EMAIL_PROVIDER=console|gmail перемикає реалізацію. */
export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<void>;
}

export const EMAIL_PROVIDER_TOKEN = 'EMAIL_PROVIDER_TOKEN';
