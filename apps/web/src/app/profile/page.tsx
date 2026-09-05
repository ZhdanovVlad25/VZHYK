'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  deleteAvatar,
  getCities,
  getMyProfile,
  linkPhone,
  requestPhoneLink,
  updateProfile,
  uploadAvatar,
  type City,
  type MyProfile,
} from '@/lib/api';
import { PHONE_PREFIX, PHONE_DIGITS_LENGTH, normalizePhoneDigits } from '@/lib/phone';
import { Alert, Avatar, Button, Card, Dropdown, Form, Input, LoadingState } from '@/components/ui';

export default function ProfilePage() {
  const { user, isLoading: authLoading, accessToken, displayName, setDisplayName, setAvatarUrl, setPhone } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [cityLocationId, setCityLocationId] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // "Додати номер телефону" — окремий міні-флоу поза основною формою (не хочемо, щоб Enter
  // у полі номера випадково зберігав ім'я/місто через onSubmit головної форми).
  const [isAddingPhone, setIsAddingPhone] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'enter' | 'code'>('enter');
  const [phoneInput, setPhoneInput] = useState(PHONE_PREFIX);
  const [phoneCode, setPhoneCode] = useState('');
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // "Приймати дзвінки" — окремий тумблер поза основною формою (зберігається одразу при
  // зміні, а не разом з рештою полів — інакше вимкнення прапорця й забудькуватість натиснути
  // "Зберегти" призвели б до розбіжності між тим, що бачить юзер, і реальним станом на сервері).
  const [acceptsCalls, setAcceptsCalls] = useState(true);
  const [isSavingAcceptsCalls, setIsSavingAcceptsCalls] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCities()
      .then((c) => !cancelled && setCities(c))
      .catch(() => !cancelled && setCities([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getMyProfile(accessToken)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setName(p.displayName ?? '');
        setUsername(p.username ?? '');
        setBio(p.bio ?? '');
        setCityLocationId(p.cityLocationId);
        setAcceptsCalls(p.acceptsCalls);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof ApiError ? err.message : 'Не вдалося завантажити профіль.'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function handleAvatarSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const updated = await uploadAvatar(file, accessToken);
      setProfile(updated);
      setAvatarUrl(updated.avatarUrl);
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Не вдалося завантажити фото.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteAvatar() {
    if (!accessToken) return;
    setAvatarError(null);
    setIsDeletingAvatar(true);
    try {
      const updated = await deleteAvatar(accessToken);
      setProfile(updated);
      setAvatarUrl(updated.avatarUrl);
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'Не вдалося видалити фото.');
    } finally {
      setIsDeletingAvatar(false);
    }
  }

  async function handleSendPhoneCode() {
    if (!accessToken) return;
    setPhoneError(null);
    setIsPhoneSubmitting(true);
    try {
      await requestPhoneLink(phoneInput, accessToken);
      setPhoneStep('code');
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : 'Не вдалося надіслати код.');
    } finally {
      setIsPhoneSubmitting(false);
    }
  }

  async function handleConfirmPhoneCode() {
    if (!accessToken) return;
    setPhoneError(null);
    setIsPhoneSubmitting(true);
    try {
      const linked = await linkPhone(phoneInput, phoneCode, accessToken);
      setPhone(linked.phone);
      setIsAddingPhone(false);
      setPhoneStep('enter');
      setPhoneCode('');
    } catch (err) {
      setPhoneError(err instanceof ApiError ? err.message : 'Не вдалося підтвердити код.');
    } finally {
      setIsPhoneSubmitting(false);
    }
  }

  async function handleToggleAcceptsCalls(next: boolean) {
    if (!accessToken) return;
    setAcceptsCalls(next);
    setIsSavingAcceptsCalls(true);
    try {
      await updateProfile({ acceptsCalls: next }, accessToken);
    } catch {
      setAcceptsCalls(!next);
    } finally {
      setIsSavingAcceptsCalls(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaveError(null);
    setSaveMessage(null);
    setIsSaving(true);
    try {
      const updated = await updateProfile(
        {
          displayName: name.trim() || undefined,
          username: username.trim() || undefined,
          bio: bio.trim() || undefined,
          cityLocationId: cityLocationId ?? undefined,
        },
        accessToken,
      );
      setProfile(updated);
      if (updated.displayName) setDisplayName(updated.displayName);
      setSaveMessage('Збережено');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700 dark:text-gray-300">Щоб редагувати профіль, потрібно увійти.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  if (authLoading || isLoading) {
    return <LoadingState label="Завантаження профілю…" />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900 dark:text-gray-100">Профіль</h1>

      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Avatar name={name || displayName} url={profile?.avatarUrl} size="lg" />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarSelected}
              disabled={isUploadingAvatar || isDeletingAvatar}
              className="sr-only"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={isUploadingAvatar}
                disabled={isDeletingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                {profile?.avatarUrl ? 'Змінити фото' : 'Додати фото'}
              </Button>
              {profile?.avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  isLoading={isDeletingAvatar}
                  disabled={isUploadingAvatar}
                  onClick={handleDeleteAvatar}
                >
                  Видалити
                </Button>
              )}
            </div>
            {avatarError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{avatarError}</p>}
          </div>
        </div>
      </Card>

      <Card>
        {loadError && (
          <Alert tone="danger" title="Помилка" className="mb-4">
            {loadError}
          </Alert>
        )}
        {saveMessage && (
          <Alert tone="success" className="mb-4">
            {saveMessage}
          </Alert>
        )}
        {saveError && (
          <Alert tone="danger" title="Помилка" className="mb-4">
            {saveError}
          </Alert>
        )}

        <Form ariaLabel="Редагування профілю" onSubmit={handleSave}>
          <Input label="Ім'я" value={name} onChange={(e) => setName(e.target.value)} placeholder="Наприклад, Олена" />
          <Input
            label="Ім'я користувача"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            hint="Необов'язково, унікальне"
          />
          <Dropdown
            label="Місто"
            options={cities.map((c) => ({ value: c.id, label: c.nameUk }))}
            value={cityLocationId}
            onChange={setCityLocationId}
            placeholder="Не вказано"
          />
          <Input label="Про себе" value={bio} onChange={(e) => setBio(e.target.value)} hint="Необов'язково" />
          <Button type="submit" isLoading={isSaving}>
            Зберегти
          </Button>
        </Form>
      </Card>

      <Card className="mt-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Телефон</span>
        {user?.phone ? (
          <>
            <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{user.phone}</p>
            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={acceptsCalls}
                disabled={isSavingAcceptsCalls}
                onChange={(e) => handleToggleAcceptsCalls(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 dark:bg-gray-800"
              />
              Приймати дзвінки
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {acceptsCalls
                ? 'Покупці бачать ваш номер і можуть зателефонувати.'
                : 'Номер прихований від покупців — лише повідомлення в чаті.'}
            </p>
          </>
        ) : (
          <div className="mt-2 flex flex-col gap-2">
            {phoneError && <Alert tone="danger">{phoneError}</Alert>}

            {!isAddingPhone && (
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddingPhone(true)}>
                Додати номер телефону
              </Button>
            )}

            {isAddingPhone && phoneStep === 'enter' && (
              <>
                <div className="flex h-10 items-center rounded-xl border border-gray-300 focus-within:border-brand-600 dark:border-gray-600">
                  <span className="select-none pl-3 text-sm text-gray-500 dark:text-gray-400" aria-hidden="true">
                    {PHONE_PREFIX}
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phoneInput.slice(PHONE_PREFIX.length)}
                    onChange={(e) => setPhoneInput(PHONE_PREFIX + normalizePhoneDigits(e.target.value))}
                    onPaste={(e) => {
                      e.preventDefault();
                      setPhoneInput(PHONE_PREFIX + normalizePhoneDigits(e.clipboardData.getData('text')));
                    }}
                    placeholder="XXXXXXXXX"
                    maxLength={PHONE_DIGITS_LENGTH}
                    autoFocus
                    className="h-full min-w-0 flex-1 rounded-r-xl border-0 bg-transparent pl-1 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    isLoading={isPhoneSubmitting}
                    disabled={phoneInput.length < PHONE_PREFIX.length + PHONE_DIGITS_LENGTH}
                    onClick={handleSendPhoneCode}
                  >
                    Надіслати код
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingPhone(false)}>
                    Скасувати
                  </Button>
                </div>
              </>
            )}

            {isAddingPhone && phoneStep === 'code' && (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Код надіслано на <span className="font-medium text-gray-900 dark:text-gray-100">{phoneInput}</span>
                </p>
                <Input
                  label="Код підтвердження"
                  inputMode="numeric"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button type="button" size="sm" isLoading={isPhoneSubmitting} onClick={handleConfirmPhoneCode}>
                    Підтвердити
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setPhoneStep('enter')}>
                    Змінити номер
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
