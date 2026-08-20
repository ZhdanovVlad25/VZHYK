'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Dropdown, Form, Input, Alert } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { ApiError, getCities, linkPhone, requestPhoneLink, updateProfile, type City } from '@/lib/api';

type Step = 'phone' | 'code' | 'linkPhone' | 'linkCode' | 'name';

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

/** useSearchParams() вимагає Suspense-межу в App Router. */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    requestOtp,
    verifyOtp,
    accessToken,
    user,
    displayName,
    isLoading: authLoading,
    setDisplayName,
    setPhone: setStoredPhone,
  } = useAuth();
  const { t } = useLanguage();

  // ?complete=1 — редірект з /auth/google/callback: користувач вже увійшов через Google,
  // токен у сховищі є, лишилось лише дозаповнити відсутнє (номер і/або ім'я/місто).
  // Google не віддає номер телефону, тож для щойно створених через Google акаунтів його
  // завжди бракує — вирішується лише коли auth-контекст підвантажиться (не при першому рендері).
  const [step, setStep] = useState<Step>(searchParams.get('complete') === '1' ? 'linkPhone' : 'phone');
  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [cityLocationId, setCityLocationId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    getCities().then(setCities).catch(() => setCities([]));
  }, []);

  // auth-контекст гідратується з localStorage асинхронно — доки authLoading, user.phone
  // ще невідомий. Щойно підвантажився: якщо телефон уже є (напр. Google-акаунт, створений
  // до цього фічі, або дублікат вкладки), одразу переходимо до кроку імені замість "linkPhone".
  useEffect(() => {
    if (searchParams.get('complete') !== '1' || authLoading) return;
    if (user?.phone) setStep('name');
  }, [searchParams, authLoading, user]);

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
      setError(err instanceof ApiError ? err.message : t('loginErrorSend'));
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
      // needsPhone тут завжди false — сам номер щойно верифіковано телефонним входом.
      const { needsName } = await verifyOtp(phone, code);
      if (needsName) {
        setStep('name');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loginErrorVerify'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendLinkCode() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (!accessToken) throw new ApiError(401, 'UNAUTHENTICATED', t('loginErrorSend'), null);
      await requestPhoneLink(phone, accessToken);
      setStep('linkCode');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loginErrorSend'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestPhoneLink(e: FormEvent) {
    e.preventDefault();
    await sendLinkCode();
  }

  // СМС коштує грошей (TurboSMS тарифікує кожне повідомлення) — прив'язка телефону після
  // Google-логіну лишається добровільною дією користувача, а не тим, що система нав'язує
  // кожному новому Google-акаунту автоматично.
  function skipPhoneLink() {
    if (displayName) {
      router.push('/');
    } else {
      setStep('name');
    }
  }

  async function handleConfirmPhoneLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (!accessToken) throw new ApiError(401, 'UNAUTHENTICATED', t('loginErrorVerify'), null);
      const linked = await linkPhone(phone, code, accessToken);
      setStoredPhone(linked.phone);
      setCode('');
      if (displayName) {
        router.push('/');
      } else {
        setStep('name');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loginErrorVerify'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveName(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (accessToken && (name.trim() || cityLocationId)) {
        await updateProfile(
          { displayName: name.trim() || undefined, cityLocationId: cityLocationId ?? undefined },
          accessToken,
        );
        if (name.trim()) setDisplayName(name.trim());
      }
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loginErrorSaveName'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">{t('loginTitle')}</h1>
      <Card>
        {error && (
          <Alert tone="danger" title={t('loginErrorTitle')} className="mb-4">
            {error}
          </Alert>
        )}

        {step === 'phone' ? (
          <Form ariaLabel="Вхід за номером телефону" onSubmit={handleRequestOtp}>
            <div className="flex flex-col gap-1">
              <label htmlFor="login-phone-digits" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('loginPhoneLabel')}
              </label>
              <div className="flex h-10 items-center rounded-xl border border-gray-300 focus-within:border-brand-600 dark:border-gray-600">
                <span className="select-none pl-3 text-sm text-gray-500 dark:text-gray-400" aria-hidden="true">
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
                  className="h-full min-w-0 flex-1 rounded-r-xl border-0 bg-transparent pl-1 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('loginPhoneHint')}</span>
            </div>
            <Button type="submit" isLoading={isSubmitting}>
              {t('loginSendCode')}
            </Button>
          </Form>
        ) : null}

        {step === 'phone' && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              {t('loginOr')}
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>
            <Button type="button" variant="secondary" onClick={handleGoogleLogin} className="w-full">
              {t('loginWithGoogle')}
            </Button>
          </>
        )}

        {step === 'code' && (
          <Form ariaLabel="Підтвердження коду" onSubmit={handleVerifyOtp}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('loginCodeSentTo')} <span className="font-medium text-gray-900 dark:text-gray-100">{phone}</span>
            </p>
            <Input
              label={t('loginCodeLabel')}
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit" isLoading={isSubmitting}>
              {t('loginConfirm')}
            </Button>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resendCooldown > 0 || isSubmitting}
                onClick={sendCode}
              >
                {resendCooldown > 0 ? `${t('loginResend')} (${resendCooldown})` : t('loginResend')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep('phone')}>
                {t('loginChangeNumber')}
              </Button>
            </div>
          </Form>
        )}

        {step === 'linkPhone' && (
          <Form ariaLabel="Прив'язка номера телефону" onSubmit={handleRequestPhoneLink}>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('loginPhoneRequiredQuestion')}</p>
            <div className="flex flex-col gap-1">
              <label htmlFor="link-phone-digits" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('loginPhoneLabel')}
              </label>
              <div className="flex h-10 items-center rounded-xl border border-gray-300 focus-within:border-brand-600 dark:border-gray-600">
                <span className="select-none pl-3 text-sm text-gray-500 dark:text-gray-400" aria-hidden="true">
                  {PHONE_PREFIX}
                </span>
                <input
                  id="link-phone-digits"
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
                  className="h-full min-w-0 flex-1 rounded-r-xl border-0 bg-transparent pl-1 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{t('loginPhoneHint')}</span>
            </div>
            <Button type="submit" isLoading={isSubmitting}>
              {t('loginSendCode')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={skipPhoneLink}>
              {t('loginSkip')}
            </Button>
          </Form>
        )}

        {step === 'linkCode' && (
          <Form ariaLabel="Підтвердження коду" onSubmit={handleConfirmPhoneLink}>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('loginCodeSentTo')} <span className="font-medium text-gray-900 dark:text-gray-100">{phone}</span>
            </p>
            <Input
              label={t('loginCodeLabel')}
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
            <Button type="submit" isLoading={isSubmitting}>
              {t('loginConfirm')}
            </Button>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={resendCooldown > 0 || isSubmitting}
                onClick={sendLinkCode}
              >
                {resendCooldown > 0 ? `${t('loginResend')} (${resendCooldown})` : t('loginResend')}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep('linkPhone')}>
                {t('loginChangeNumber')}
              </Button>
            </div>
          </Form>
        )}

        {step === 'name' && (
          <Form ariaLabel="Ваше ім'я" onSubmit={handleSaveName}>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('loginNameQuestion')}</p>
            <Input
              label={t('loginNameLabel')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('loginNamePlaceholder')}
              autoFocus
            />
            <Dropdown
              label={t('cityLabel')}
              options={cities.map((c) => ({ value: c.id, label: c.nameUk }))}
              value={cityLocationId}
              onChange={setCityLocationId}
              placeholder={t('allCities')}
            />
            <Button type="submit" isLoading={isSubmitting}>
              {t('loginContinue')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/')}>
              {t('loginSkip')}
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
