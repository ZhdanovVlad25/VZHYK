import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getPublicProfile, type PublicProfile } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
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

/** Блок продавця під ціною оголошення — RN-порт SellerCard.tsx. */
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

  return (
    <View style={styles.card}>
      <Avatar url={profile.avatarUrl} />
      <View style={styles.info}>
        <Text style={styles.name}>{profile.displayName ?? 'Продавець'}</Text>
        {profile.lastActiveAt && <Text style={styles.lastSeen}>{formatLastSeen(profile.lastActiveAt)}</Text>}
      </View>
      <Pressable onPress={() => navigation.navigate('Tabs', { screen: 'Search', params: { seller: sellerId } })}>
        <Text style={styles.link}>Інші оголошення</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
  card: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.brand[50],
    borderWidth: 1,
    borderColor: colors.brand[100],
    borderRadius: 16,
    padding: 12,
  },
  info: { flex: 1, minWidth: 0 },
  // Картка завжди на світлій brand[50] поверхні незалежно від теми (див. theme.ts) —
  // текст тому бере фіксовані бренд-відтінки, інакше в темній темі зливається з фоном.
  name: { fontWeight: '500', color: colors.brand[900], fontSize: 14 },
  lastSeen: { fontSize: 12, color: colors.brand[700], marginTop: 2 },
  link: { fontSize: 13, fontWeight: '500', color: colors.accent[700] },
  });
}
