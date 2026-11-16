import { useAppTheme } from '@/hooks/useAppTheme';
import { colorAlpha } from '@/design-system/tokens/garden';
import CloseButton from '@/ui/CloseButton';
import React from 'react';
import { Modal, View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/ui/ThemedText';
import { Typography } from '@/design-system/tokens';
import { useReducedMotion } from '@/ui/GrowMotion';

interface ConfirmDeleteModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: string;
}

export default function ConfirmDeleteModal({
  visible,
  title = 'Delete garden',
  subtitle = "This will NOT delete your plants, only the garden.",
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  error,
}: ConfirmDeleteModalProps) {
  const t = useAppTheme();
  const styles = makeStyles(t);
  const reduced = useReducedMotion();
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'fade'} transparent onRequestClose={() => { if (!loading) onCancel(); }}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={[colorAlpha(t.text, .06), colorAlpha(t.text, .03)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card]}
        >
          {/* Accent */}
          <LinearGradient
            colors={[colorAlpha(t.danger, .28), colorAlpha(t.accent, .14), 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.accent}
          />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}><View style={styles.iconWrap}>
            <MaterialCommunityIcons name="delete-alert" size={28} color={t.danger} />
          </View><CloseButton label="Close delete confirmation" disabled={loading} onPress={onCancel} /></View>
          <ThemedText type="title" style={styles.title}>{title}</ThemedText>
          <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
          {!!error && <ThemedText accessibilityRole="alert" style={{ color: t.danger, marginTop: 12 }}>{error}</ThemedText>}

          <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={loading} onPress={onCancel} style={({ pressed }) => [styles.btn, styles.cancelBtn, pressed && styles.pressed]}>
              <ThemedText style={styles.cancelText}>{cancelLabel}</ThemedText>
            </Pressable>
            <LinearGradient colors={[t.danger, t.danger]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.confirmGrad}>
              <Pressable accessibilityRole="button" disabled={loading} onPress={onConfirm} style={({ pressed }) => [styles.btn, styles.confirmBtn, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={t.onDanger} style={{ marginRight: 8 }} />
                <ThemedText style={styles.confirmText}>{loading ? 'Deleting…' : confirmLabel}</ThemedText>
              </Pressable>
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const makeStyles = (t: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colorAlpha(t.scrim, .55),
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 26,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    shadowColor: t.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  accent: {
    position: 'absolute',
    top: -50,
    right: -60,
    width: 220,
    height: 180,
    transform: [{ rotate: '20deg' }],
    borderRadius: 120,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colorAlpha(t.danger, .15),
    borderWidth: 1,
    borderColor: colorAlpha(t.danger, .3)
  },
  title: {
    ...Typography.styles.h3,
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    ...Typography.styles.body,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    backgroundColor: colorAlpha(t.text, .06),
    borderColor: t.border,
    borderWidth: 1,
  },
  cancelText: {
    color: t.text,
    fontWeight: '700',
  },
  confirmGrad: {
    flex: 1,
    borderRadius: 12,
  },
  confirmBtn: {
    backgroundColor: 'transparent',
  },
  confirmText: {
    color: t.onDanger,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  }
});
