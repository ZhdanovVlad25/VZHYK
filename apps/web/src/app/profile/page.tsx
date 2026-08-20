'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  getCities,
  getMyProfile,
  updateProfile,
  uploadAvatar,
  type City,
  type MyProfile,
} from '@/lib/api';
import { Alert, Avatar, Button, Card, Dropdown, Form, Input, LoadingState } from '@/components/ui';

export default function ProfilePage() {
  const { user, isLoading: authLoading, accessToken, displayName, setDisplayName, setAvatarUrl } = useAuth();
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
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
              disabled={isUploadingAvatar}
              className="sr-only"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              {profile?.avatarUrl ? 'Змінити фото' : 'Додати фото'}
            </Button>
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Телефон: <span className="text-gray-900 dark:text-gray-100">{user?.phone ?? '—'}</span>
          </p>
          <Button type="submit" isLoading={isSaving}>
            Зберегти
          </Button>
        </Form>
      </Card>
    </div>
  );
}
