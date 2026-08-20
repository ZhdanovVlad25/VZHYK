/** Той самий патерн, що StorageProvider (docs/architecture.md §4) — SMS_PROVIDER=console|twilio перемикає реалізацію. */
export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

// Навмисно НЕ "SMS_PROVIDER" — цей рядок легко сплутати з env-змінною SMS_PROVIDER
// (console|twilio), яка вибирає саме цю реалізацію в sms.module.ts.
export const SMS_PROVIDER_TOKEN = 'SMS_PROVIDER_TOKEN';
