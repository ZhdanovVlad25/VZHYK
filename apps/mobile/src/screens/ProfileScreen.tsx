import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ApiError, City, MyProfile, ProfileStats, getCities, getMyProfile, getMyProfileStats, updateProfile, uploadAvatar } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useLanguage } from '../lib/language-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { assetToRNFile, pickPhoto } from '../lib/pickImage';
import { Avatar } from '../components/Avatar';
import { DropdownSelect } from '../components/DropdownSelect';
import { LanguageToggle } from '../components/LanguageToggle';
import { LoadingScreen } from '../components/LoadingScreen';
import { ThemeToggle } from '../components/ThemeToggle';
import type { AppNavigation } from '../navigation/types';

type Step = 'phone' | 'code' | 'name';

const PHONE_PREFIX = '+380';
const PHONE_DIGITS_LENGTH = 9;
const RESEND_COOLDOWN_SECONDS = 60;

function formatMemberSince(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** Приймає як руками надруковані цифри, так і вставлений повний номер (з "+380"/"380"/пробілами) — той самий парсинг, що web login/page.tsx. */
function normalizePhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('380')) {
    digits = digits.slice(3);
  }
  digits = digits.replace(/^0+/, '');
  return digits.slice(0, PHONE_DIGITS_LENGTH);
}

/** OTP-вхід + профіль — RN-порт apps/web/src/app/login/page.tsx, вбудований у таб "Профіль" замість окремого маршруту. */
export function ProfileScreen() {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors);
  const { user, displayName, avatarUrl, isLoading, requestOtp, verifyOtp, setDisplayName, setAvatarUrl, accessToken, logout } =
    useAuth();

  const [step, setStep] = useState<Step>('phone');
  const [pendingName, setPendingName] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCityId, setEditCityId] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveMessage, setProfileSaveMessage] = useState<string | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);

  useEffect(() => {
    getCities().then(setCities).catch(() => setCities([]));
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    getMyProfile(accessToken).then((p) => {
      setProfile(p);
      setEditName(p.displayName ?? '');
      setEditUsername(p.username ?? '');
      setEditBio(p.bio ?? '');
      setEditCityId(p.cityLocationId);
    });
    getMyProfileStats(accessToken).then(setStats).catch(() => setStats(null));
  }, [accessToken]);

  async function handleAvatarPick() {
    if (!accessToken) return;
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const asset = await pickPhoto();
      if (!asset) return;
      const updated = await uploadAvatar(assetToRNFile(asset), accessToken);
      setProfile(updated);
      setAvatarUrl(updated.avatarUrl);
    } catch (err) {
      setAvatarError(err instanceof ApiError || err instanceof Error ? err.message : 'Не вдалося завантажити фото.');
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSaveProfile() {
    if (!accessToken) return;
    setProfileSaveError(null);
    setProfileSaveMessage(null);
    setIsSavingProfile(true);
    try {
      const updated = await updateProfile(
        {
          displayName: editName.trim() || undefined,
          username: editUsername.trim() || undefined,
          bio: editBio.trim() || undefined,
          cityLocationId: editCityId ?? undefined,
        },
        accessToken,
      );
      setProfile(updated);
      if (updated.displayName) setDisplayName(updated.displayName);
      setProfileSaveMessage('Збережено');
    } catch (err) {
      setProfileSaveError(err instanceof ApiError ? err.message : 'Не вдалося зберегти зміни.');
    } finally {
      setIsSavingProfile(false);
    }
  }

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function sendCode() {
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(PHONE_PREFIX + phoneDigits);
      setStep('code');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loginErrorSend'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { needsName } = await verifyOtp(PHONE_PREFIX + phoneDigits, code);
      if (needsName) setPendingName(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loginErrorVerify'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveName() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (accessToken && name.trim()) {
        await updateProfile({ displayName: name.trim() }, accessToken);
        setDisplayName(name.trim());
      }
      setPendingName(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('loginErrorSaveName'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const settingsRow = (
    <View style={styles.settingsRow}>
      <ThemeToggle />
      <LanguageToggle />
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <LoadingScreen />
      </View>
    );
  }

  if (user && !pendingName) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.profileContainer, { paddingTop: insets.top + 24 }]} keyboardShouldPersistTaps="handled">
          {settingsRow}

          <View style={styles.avatarRow}>
            <Avatar url={avatarUrl} size="lg" />
            <Pressable style={styles.avatarButton} onPress={handleAvatarPick} disabled={isUploadingAvatar}>
              {isUploadingAvatar ? (
                <ActivityIndicator color={colors.accent[700]} size="small" />
              ) : (
                <Text style={styles.avatarButtonText}>{profile?.avatarUrl ? 'Змінити фото' : 'Додати фото'}</Text>
              )}
            </Pressable>
          </View>
          {avatarError && <Text style={styles.errorTextInline}>{avatarError}</Text>}

          {stats && (
            <View style={styles.statsCard}>
              <View style={styles.statsRow}>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{stats.activeListingsCount}</Text>
                  <Text style={styles.statLabel}>Активних оголошень</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{stats.totalViewsCount}</Text>
                  <Text style={styles.statLabel}>Переглядів усього</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{stats.favoritesCount}</Text>
                  <Text style={styles.statLabel}>В обраному</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{stats.totalListingsCount}</Text>
                  <Text style={styles.statLabel}>Оголошень усього</Text>
                </View>
              </View>
              <Text style={styles.memberSince}>З нами з {formatMemberSince(stats.memberSince)}</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <Pressable style={styles.myListingsButton} onPress={() => navigation.navigate('MyListings')}>
              <Text style={styles.myListingsButtonText}>{t('myListings')}</Text>
            </Pressable>
            <Pressable style={styles.secondaryActionButton} onPress={() => navigation.navigate('Favorites')}>
              <Text style={styles.secondaryActionButtonText}>{t('favorites')}</Text>
            </Pressable>
          </View>

          {profileSaveMessage && (
            <View style={styles.successBox}>
              <Text style={styles.successText}>{profileSaveMessage}</Text>
            </View>
          )}
          {profileSaveError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{profileSaveError}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Ім'я</Text>
            <TextInput value={editName} onChangeText={setEditName} placeholder="Наприклад, Олена" placeholderTextColor={colors.textMuted} style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ім'я користувача</Text>
            <TextInput
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="Необов'язково, унікальне"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Про себе</Text>
            <TextInput value={editBio} onChangeText={setEditBio} placeholder="Необов'язково" placeholderTextColor={colors.textMuted} style={styles.input} />
          </View>

          <DropdownSelect
            label="Місто"
            options={cities.map((c) => ({ value: c.id, label: c.nameUk }))}
            value={editCityId}
            onChange={setEditCityId}
            emptyHint="Не вказано"
          />

          <Text style={styles.hint}>
            Телефон: <Text style={styles.hintValue}>{user.phone ?? '—'}</Text>
          </Text>

          <Pressable style={styles.primaryButton} onPress={handleSaveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? <ActivityIndicator color={colors.buttonText} /> : <Text style={styles.primaryButtonText}>Зберегти</Text>}
          </Pressable>

          <Pressable
            style={styles.logoutButton}
            onPress={() => {
              logout();
              setStep('phone');
              setPhoneDigits('');
              setCode('');
              setName('');
            }}
          >
            <Text style={styles.logoutButtonText}>{t('logout')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 48 }]} keyboardShouldPersistTaps="handled">
        {settingsRow}

        <Text style={styles.title}>{t('loginTitle')}</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {pendingName ? (
          <>
            <Text style={styles.label}>{t('loginNameQuestion')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('loginNamePlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoFocus
              style={styles.input}
            />
            <Pressable style={styles.primaryButton} onPress={handleSaveName} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.buttonText} /> : <Text style={styles.primaryButtonText}>{t('loginContinue')}</Text>}
            </Pressable>
            <Pressable onPress={() => setPendingName(false)}>
              <Text style={styles.linkButton}>{t('loginSkip')}</Text>
            </Pressable>
          </>
        ) : step === 'phone' ? (
          <>
            <Text style={styles.label}>{t('loginPhoneLabel')}</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.phonePrefix}>{PHONE_PREFIX}</Text>
              <TextInput
                value={phoneDigits}
                onChangeText={(v) => setPhoneDigits(normalizePhoneDigits(v))}
                placeholder="XXXXXXXXX"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={PHONE_DIGITS_LENGTH}
                autoFocus
                style={styles.phoneInput}
              />
            </View>
            <Text style={styles.hint}>{t('loginPhoneHint')}</Text>
            <Pressable
              style={[styles.primaryButton, phoneDigits.length < PHONE_DIGITS_LENGTH && styles.primaryButtonDisabled]}
              onPress={sendCode}
              disabled={isSubmitting || phoneDigits.length < PHONE_DIGITS_LENGTH}
            >
              {isSubmitting ? <ActivityIndicator color={colors.buttonText} /> : <Text style={styles.primaryButtonText}>{t('loginSendCode')}</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>
              {t('loginCodeSentTo')} {PHONE_PREFIX}
              {phoneDigits}
            </Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={t('loginCodeLabel')}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
              style={styles.input}
            />
            <Pressable style={styles.primaryButton} onPress={handleVerifyOtp} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={colors.buttonText} /> : <Text style={styles.primaryButtonText}>{t('loginConfirm')}</Text>}
            </Pressable>
            <View style={styles.secondaryRow}>
              <Pressable disabled={resendCooldown > 0 || isSubmitting} onPress={sendCode}>
                <Text style={[styles.linkButton, resendCooldown > 0 && styles.linkButtonDisabled]}>
                  {resendCooldown > 0 ? `${t('loginResend')} (${resendCooldown})` : t('loginResend')}
                </Text>
              </Pressable>
              <Pressable onPress={() => setStep('phone')}>
                <Text style={styles.linkButton}>{t('loginChangeNumber')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.page },
    center: { flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
    container: { flexGrow: 1, padding: 24, paddingTop: 48, gap: 12 },
    profileContainer: { flexGrow: 1, padding: 20, paddingTop: 24, gap: 14 },
    settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '500', color: colors.text },
    field: { gap: 6 },
    hint: { fontSize: 13, color: colors.textMuted },
    hintValue: { color: colors.text, fontWeight: '500' },
    avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    statsCard: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    statsRow: { flexDirection: 'row', gap: 10 },
    statTile: {
      flex: 1,
      backgroundColor: colors.brand[50],
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 2,
    },
    statValue: { fontSize: 20, fontWeight: '800', color: colors.brand[900] },
    statLabel: { fontSize: 11, color: colors.brand[700] },
    memberSince: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
    avatarButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.white,
    },
    avatarButtonText: { color: colors.accent[700], fontWeight: '600', fontSize: 13 },
    errorTextInline: { color: colors.accent[600], fontSize: 12 },
    successBox: {
      backgroundColor: colors.brand[50],
      borderWidth: 1,
      borderColor: colors.brand[100],
      borderRadius: 10,
      padding: 12,
    },
    successText: { color: colors.brand[700], fontSize: 13 },
    input: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingLeft: 14,
    },
    phonePrefix: { fontSize: 16, color: colors.textMuted },
    phoneInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 12, fontSize: 16, color: colors.text },
    primaryButton: {
      backgroundColor: colors.accent[600],
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    primaryButtonDisabled: { opacity: 0.5 },
    primaryButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 15 },
    secondaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    linkButton: { color: colors.accent[700], fontSize: 13, fontWeight: '500' },
    linkButtonDisabled: { color: colors.textMuted },
    errorBox: {
      backgroundColor: colors.accent[50],
      borderWidth: 1,
      borderColor: colors.accent[100],
      borderRadius: 10,
      padding: 12,
    },
    errorText: { color: colors.accent[600], fontSize: 13 },
    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    myListingsButton: {
      backgroundColor: colors.accent[600],
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    myListingsButtonText: { color: colors.buttonText, fontWeight: '600' },
    secondaryActionButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 12,
      backgroundColor: colors.white,
    },
    secondaryActionButtonText: { color: colors.accent[700], fontWeight: '600' },
    logoutButton: {
      marginTop: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    logoutButtonText: { color: colors.accent[600], fontWeight: '600' },
  });
}
