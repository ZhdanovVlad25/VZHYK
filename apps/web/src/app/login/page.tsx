'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Form, Input, Alert } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';

type Step = 'phone' | 'code';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

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
  const { requestOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('+380');
  const [code, setCode] = useState('');
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
      await verifyOtp(phone, code);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося підтвердити код. Спробуйте ще раз.');
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
            <Input
              label="Номер телефону"
              type="tel"
              inputMode="tel"
              hint="У форматі +380XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              required
            />
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
      </Card>
    </div>
  );
}
