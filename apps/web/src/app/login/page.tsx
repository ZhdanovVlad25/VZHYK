'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Form, Input, Alert } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { ApiError, updateProfile } from '@/lib/api';

type Step = 'phone' | 'code' | 'name';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// "+380" — незмінний префікс поля телефону: користувач вводить лише код оператора
// й номер (9 цифр). Захист від реального інциденту цієї сесії — вручну надрукований
// "+3800671112233" (зайвий 0 після 380) не збігався з жодним записаним OTP і завжди
// падав з "Невірний код", хоча код був правильний.
const PHONE_PREFIX = '+380';
const PHONE_DIGITS_LENGTH = 9;

/** Приймає як руками надруковані цифри, так і вставлений повний номер (з "+380"/"380"/пробілами). */
function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('380')) {
    digits = digits.slice(3);
  }
  // Код оператора (67/50/63/...) ніколи не починається з 0 — саме так виглядав реальний
  // одрук цієї сесії ("+3800671112233"): зайвий 0 одразу після "380".
  digits = digits.replace(/^0+/, '');
  return digits.slice(0, PHONE_DIGITS_LENGTH);
}

// Бекенд дозволяє лише 3 запити коду на номер за 15 хв
// (OTP_REQUEST_LIMIT_PER_PHONE_15MIN, docs/security.md §6) — кожен новий запит
// інвалідовує попередній код, тож без таймера легко спамити "Надіслати ще раз"
// і самому собі зламати вхід (код у руках стає невірним) або впертися в rate limit.
const RESEND_COOLDOWN_SECONDS = 60;

function handleGoogleLogin() {
  window.location.href = `${API_URL}/auth/google`;
}

export default function LoginPage() {
  const router = useRouter();
  const { requestOtp, verifyOtp, accessToken, setDisplayName } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function sendCode() {
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(phone);
      setStep('code');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося надіслати код. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { needsName } = await verifyOtp(phone, code);
      if (needsName) {
        setStep('name');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося підтвердити код. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (accessToken && name.trim()) {
        await updateProfile({ displayName: name.trim() }, accessToken);
        setDisplayName(name.trim());
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не вдалося зберегти ім'я. Спробуйте ще раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Вхід</h1>
      <Card>
        {error && (
          <Alert tone="danger" title="Помилка" className="mb-4">
            {error}
          </Alert>
        )}

        {step === 'phone' ? (
          <Form ariaLabel="Вхід за номером телефону" onSubmit={handleRequestOtp}>
            <div className="flex flex-col gap-1">
              <label htmlFor="login-phone-digits" className="text-sm font-medium text-gray-700">
                Номер телефону
              </label>
              <div className="flex h-10 items-center rounded-xl border border-gray-300 focus-within:border-brand-600">
                <span className="select-none pl-3 text-sm text-gray-500" aria-hidden="true">
                  {PHONE_PREFIX}
                </span>
                <input
                  id="login-phone-digits"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phone.slice(PHONE_PREFIX.length)}
                  onChange={(e) => setPhone(PHONE_PREFIX + normalizePhoneDigits(e.target.value))}
                  onPaste={(e) => {
                    e.preventDefault();
                    setPhone(PHONE_PREFIX + normalizePhoneDigits(e.clipboardData.getData('text')));
                  }}
                  placeholder="XXXXXXXXX"
                  maxLength={PHONE_DIGITS_LENGTH}
                  autoFocus
                  required
                  className="h-full min-w-0 flex-1 rounded-r-xl border-0 bg-transparent pl-1 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                />
              </div>
              <span className="text-xs text-gray-500">Код оператора й номер, без +380 — 9 цифр</span>
            </div>
            <Button type="submit" isLoading={isSubmitting}>
              Надіслати код
            </Button>
          </Form>
        ) : null}

        {step === 'phone' && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-gray-400">
              <span className="h-px flex-1 bg-gray-200" />
              або
              <span className="h-px flex-1 bg-gray-200" />
            </div>
            <Button type="button" variant="secondary" onClick={handleGoogleLogin} className="w-full">
              Увійти через Google
            </Button>
          </>
        )}

        {step === 'code' && (
          <Form ariaLabel="Підтвердження коду" onSubmit={handleVerifyOtp}>
            <p className="text-sm text-gray-600">
              Код надіслано на <span className="font-medium">{phone}</span>
            </p>
            <Input
              label="Код підтвердження"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit" isLoading={isSubmitting}>
              Підтвердити
            </Button>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resendCooldown > 0 || isSubmitting}
                onClick={sendCode}
              >
                {resendCooldown > 0 ? `Надіслати ще раз (${resendCooldown})` : 'Надіслати ще раз'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep('phone')}>
                Змінити номер
              </Button>
            </div>
          </Form>
        )}

        {step === 'name' && (
          <Form ariaLabel="Ваше ім'я" onSubmit={handleSaveName}>
            <p className="text-sm text-gray-600">
              Як до вас звертатися? Ім&apos;я буде видно іншим замість номера телефону.
            </p>
            <Input
              label="Ім'я"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, Олена"
              autoFocus
            />
            <Button type="submit" isLoading={isSubmitting}>
              Продовжити
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/')}>
              Пропустити
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
