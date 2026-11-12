import React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gardenThemes } from '@/design-system/tokens/garden';
import { GrowPress, useReducedMotion } from './GrowMotion';

type Action = { label: string; onPress(): void | Promise<void> };
type Props = { visible: boolean; onDismiss(): void; children?: React.ReactNode; detail?: string; action?: Action; duration?: number; bottom?: number; tone?: 'info' | 'success' | 'error'; style?: StyleProp<ViewStyle> };
const t = gardenThemes.grove;

/** Non-blocking feedback above navigation, with a real exit and an accessible Undo. */
export default function AppNotice({ visible, onDismiss, children, detail, action, duration = 4500, bottom = 88, tone = 'info', style }: Props) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = React.useState(visible);
  const [content, setContent] = React.useState({ children, detail, action, tone });
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState('');
  const lock = React.useRef(false);
  const dismiss = React.useRef(onDismiss);
  dismiss.current = onDismiss;
  const progress = React.useRef(new Animated.Value(reduced && visible ? 1 : 0)).current;
  React.useEffect(() => {
    if (visible) { setMounted(true); setContent({ children, detail, action, tone }); }
  }, [visible, children, detail, action, tone]);
  React.useEffect(() => { setActionError(''); }, [children, visible]);
  React.useEffect(() => {
    if (reduced) { progress.stopAnimation(); progress.setValue(visible ? 1 : 0); if (!visible) setMounted(false); return; }
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: visible ? 240 : 150, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false });
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [visible, reduced, progress]);
  React.useEffect(() => {
    if (!visible || busy || actionError || tone === 'error' || duration <= 0) return;
    const timer = setTimeout(() => dismiss.current(), duration);
    return () => clearTimeout(timer);
  }, [visible, children, detail, tone, duration, busy, actionError]);
  if (!mounted) return null;
  const error = !!actionError || content.tone === 'error';
  const color = error ? t.danger : content.tone === 'success' ? t.accent : t.water;
  return <Portal><View pointerEvents="box-none" style={[s.anchor, { bottom: bottom + insets.bottom }, style]}>
    <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible} aria-hidden={!visible} style={[s.notice, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }] }]}>
      <MaterialCommunityIcons name={error ? 'alert-circle-outline' : content.tone === 'success' ? 'check-circle-outline' : 'information-outline'} size={22} color={color} accessible={false} />
      <View style={{ flex: 1, gap: 2 }}><Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[s.message, content.detail && !error ? { fontWeight: '600' } : undefined]}>{actionError || content.children}</Text>{!!content.detail && !error && <Text style={{ color: t.muted, fontSize: 12, lineHeight: 18 }}>{content.detail}</Text>}</View>
      {content.action && <GrowPress accessibilityRole="button" accessibilityLabel={busy ? `${content.action.label}, working` : actionError ? `Retry ${content.action.label}` : content.action.label} accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={async () => {
        if (lock.current) return;
        lock.current = true; setBusy(true); setActionError('');
        try { await content.action!.onPress(); } catch { setActionError('Could not complete that action. Please try again.'); }
        finally { lock.current = false; setBusy(false); }
      }} style={s.action}><Text style={s.actionText}>{busy ? 'Working…' : actionError ? 'Retry' : content.action.label}</Text></GrowPress>}
      <GrowPress accessibilityRole="button" accessibilityLabel="Dismiss notification" disabled={busy} onPress={() => dismiss.current()} style={s.dismiss}><MaterialCommunityIcons name="close" size={17} color={t.muted} /></GrowPress>
    </Animated.View>
  </View></Portal>;
}
const s = StyleSheet.create({
  anchor: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  notice: { width: '100%', maxWidth: 520, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6, paddingVertical: 8, borderRadius: 20, backgroundColor: '#263d30', borderWidth: 1, borderColor: '#577050', boxShadow: '0px 10px 32px rgba(4,15,9,0.32)' },
  message: { color: t.text, fontSize: 14, lineHeight: 20 },
  action: { minHeight: 40, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 12, backgroundColor: '#354e35' },
  actionText: { color: t.accent, fontSize: 13, fontWeight: '700' },
  dismiss: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
