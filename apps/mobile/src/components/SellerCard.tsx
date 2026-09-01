import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { getPublicProfile, type PublicProfile } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { formatMemberSince, pluralizeListings } from '../lib/format';
import { Avatar } from './Avatar';
import type { AppNavigation } from '../navigation/types';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function formatLastSeen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < ONLINE_THRESHOLD_MS) return 'Онлайн';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Був(ла) в мережі ${minutes} хв тому`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Був(ла) в мережі ${hours} год тому`;
  const days = Math.floor(hours / 24);
  return `Був(ла) в мережі ${days} дн тому`;
}

/** Помаранчевий 3D-щит (без білого підкладу) — той самий вигляд, що на вебі (SellerCard.tsx). */
function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#FB923C" />
          <Stop offset="100%" stopColor="#C2410C" />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 1.5l8.5 3.2v5.7c0 5.4-3.6 10.2-8.5 11.6C7.1 20.6 3.5 15.8 3.5 10.4V4.7L12 1.5z"
        fill="url(#shieldGrad)"
      />
      <Path d="M12 1.5v20c4.9-1.4 8.5-6.2 8.5-11.6V4.7L12 1.5z" fill="#000" opacity={0.12} />
    </Svg>
  );
}

/**
 * Блок продавця під ціною оголошення — RN-порт apps/web/src/components/listings/SellerCard.tsx
 * (портовано разом з "шаром довіри" аудиту 27.08: бейдж підтвердженого телефону, "На Вжику
 * з...", повнорядковий лінк на інші оголошення, safety-tip з іконкою щита).
 */
export function SellerCard({ sellerId }: { sellerId: string }) {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicProfile(sellerId, accessToken ?? undefined)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId, accessToken]);

  if (!profile) return null;

  const lastSeenLabel = profile.lastActiveAt ? formatLastSeen(profile.lastActiveAt) : null;
  const isOnline = lastSeenLabel === 'Онлайн';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Avatar url={profile.avatarUrl} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.displayName ?? 'Продавець'}</Text>
            {profile.phoneVerified && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>✓ Телефон підтверджено</Text>
              </View>
            )}
          </View>
          <Text style={styles.memberSince}>
            На Вжику з {formatMemberSince(profile.memberSince)}
            {profile.activeListingsCount > 0 && ` · ${profile.activeListingsCount} ${pluralizeListings(profile.activeListingsCount)}`}
          </Text>
          {lastSeenLabel && (
            <View style={styles.lastSeenRow}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22C55E' : colors.textMuted }]} />
              <Text style={styles.lastSeen}>{lastSeenLabel}</Text>
            </View>
          )}
        </View>
      </View>

      <Pressable
        style={styles.otherListingsButton}
        onPress={() => navigation.navigate('Tabs', { screen: 'Search', params: { seller: sellerId } })}
      >
        <Text style={styles.otherListingsText}>Інші оголошення автора</Text>
        <Text style={styles.otherListingsArrow}>→</Text>
      </Pressable>

      <View style={styles.safetyTip}>
        <ShieldIcon size={16} />
        <Text style={styles.safetyTipText}>
          Спілкуйтесь у чаті платформи й не переказуйте передоплату наперед — це найчастіша
          причина шахрайства на дошках оголошень.
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    card: {
      marginTop: 16,
      backgroundColor: colors.brand[50],
      borderWidth: 1,
      borderColor: colors.brand[100],
      borderRadius: 16,
      padding: 14,
      gap: 12,
    },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    info: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    // Картка завжди на світлій brand[50] поверхні незалежно від теми (theme.ts) — текст
    // тому бере фіксовані бренд-відтінки, інакше в темній темі зливається з фоном.
    name: { fontWeight: '500', color: colors.brand[900], fontSize: 14 },
    badge: {
      backgroundColor: colors.brand[100],
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 11, fontWeight: '600', color: colors.brand[700] },
    memberSince: { fontSize: 12, color: colors.brand[700], marginTop: 3 },
    lastSeenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    lastSeen: { fontSize: 12, color: colors.brand[700] },
    otherListingsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.brand[100],
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    otherListingsText: { fontSize: 13, fontWeight: '600', color: colors.brand[700] },
    otherListingsArrow: { fontSize: 14, color: colors.brand[700] },
    safetyTip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: colors.brand[100],
      paddingTop: 10,
    },
    safetyTipText: { flex: 1, fontSize: 11, color: colors.brand[700], lineHeight: 15 },
  });
}
