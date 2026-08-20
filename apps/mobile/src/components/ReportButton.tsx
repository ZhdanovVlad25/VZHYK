import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ApiError, createReport, type ReportReason, type ReportTargetType } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useTheme } from '../lib/theme-context';
import type { ColorScheme } from '../lib/theme';
import { DropdownSelect } from './DropdownSelect';
import type { AppNavigation } from '../navigation/types';

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Спам' },
  { value: 'FRAUD', label: 'Шахрайство' },
  { value: 'PROHIBITED_ITEM', label: 'Заборонений товар' },
  { value: 'OFFENSIVE_CONTENT', label: 'Образливий контент' },
  { value: 'DUPLICATE', label: 'Дублікат' },
  { value: 'OTHER', label: 'Інше' },
];

/** "Поскаржитись" — RN-порт apps/web/src/components/shared/ReportButton.tsx. */
export function ReportButton({ targetType, targetId }: { targetType: ReportTargetType; targetId: string }) {
  const navigation = useNavigation<AppNavigation>();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  function handleOpen() {
    if (!user || !accessToken) {
      navigation.navigate('Tabs', { screen: 'Profile' });
      return;
    }
    setIsOpen(true);
  }

  async function handleSubmit() {
    if (!accessToken || !reason) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createReport({ targetType, targetId, reason }, accessToken);
      setIsSent(true);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося надіслати скаргу.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return <Text style={styles.sentText}>Скаргу надіслано, дякуємо</Text>;
  }

  if (!isOpen) {
    return (
      <Pressable onPress={handleOpen}>
        <Text style={styles.link}>Поскаржитись</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.box}>
      <DropdownSelect label="Причина скарги" options={REASON_OPTIONS} value={reason} onChange={(v) => setReason(v as ReportReason)} />
      {error && <Text style={styles.errorText}>{error}</Text>}
      <View style={styles.actions}>
        <Pressable style={[styles.sendButton, !reason && styles.sendButtonDisabled]} onPress={handleSubmit} disabled={!reason || isSubmitting}>
          <Text style={styles.sendButtonText}>{isSubmitting ? 'Надсилання…' : 'Надіслати'}</Text>
        </Pressable>
        <Pressable style={styles.cancelButton} onPress={() => setIsOpen(false)}>
          <Text style={styles.cancelButtonText}>Скасувати</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorScheme) {
  return StyleSheet.create({
    link: { color: colors.textMuted, fontSize: 13, fontWeight: '500', textDecorationLine: 'underline' },
    sentText: { color: colors.textMuted, fontSize: 13 },
    box: {
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
    },
    errorText: { color: colors.accent[600], fontSize: 12 },
    actions: { flexDirection: 'row', gap: 8 },
    sendButton: { backgroundColor: colors.accent[600], borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
    sendButtonDisabled: { opacity: 0.5 },
    sendButtonText: { color: colors.buttonText, fontWeight: '600', fontSize: 13 },
    cancelButton: { paddingHorizontal: 14, paddingVertical: 8 },
    cancelButtonText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  });
}
