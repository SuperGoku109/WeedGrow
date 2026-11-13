import { useAppTheme } from '@/hooks/useAppTheme';
import React from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GrowPress, useReducedMotion } from './GrowMotion';
import { gardenThemes } from '@/design-system/tokens/garden';

export type MenuAnchor = { x: number; y: number; width: number; height: number };
type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export type MenuAction = { label: string; icon: Icon; onPress(): void; separate?: boolean; danger?: boolean; accessibilityLabel?: string };
type TriggerTone = 'surface' | 'hero';
const triggerColors = (tone: TriggerTone, active: boolean, t: typeof gardenThemes.grove) => tone === 'hero'
  ? { background: active ? t.hero : t.hero, border: active ? '#90a471' : 'transparent', ink: t.heroText }
  : { background: active ? t.elevated : 'transparent', border: active ? t.accent : 'transparent', ink: active ? t.accent : t.muted };

export function menuPosition(anchor: MenuAnchor, width: number, height: number, wantedHeight: number, topInset = 0, bottomInset = 0, preferredWidth = 272) {
  const margin = 12;
  const menuWidth = Math.min(preferredWidth, width - margin * 2);
  const top = Math.max(margin, topInset + 8);
  const bottom = height - Math.max(margin, bottomInset + 8);
  const below = bottom - anchor.y - anchor.height - 10;
  const above = anchor.y - top - 10;
  const opensBelow = below >= wantedHeight || below >= above;
  const maxHeight = Math.max(48, opensBelow ? below : above);
  const menuHeight = Math.min(wantedHeight, maxHeight);
  const left = Math.max(margin, Math.min(anchor.x + anchor.width - menuWidth, width - menuWidth - margin));
  return { left, top: Math.max(top, Math.min(opensBelow ? anchor.y + anchor.height + 10 : anchor.y - menuHeight - 10, bottom - menuHeight)), width: menuWidth, maxHeight, opensBelow, pointer: Math.max(20, Math.min(anchor.x + anchor.width / 2 - left, menuWidth - 20)) };
}

export function OverflowMenuButton({ label, onOpen, expanded = false, disabled = false, horizontal = false, tone = 'surface' }: { label: string; onOpen(anchor: MenuAnchor): void; expanded?: boolean; disabled?: boolean; horizontal?: boolean; tone?: TriggerTone }) {
  const t = useAppTheme();
  const ref = React.useRef<View>(null);
  return <View ref={ref} collapsable={false} style={{ width: 40, height: 40, alignSelf: 'center', flexShrink: 0 }}><GrowPress accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded, disabled }} disabled={disabled} onPress={() => ref.current?.measureInWindow((x, y, width, height) => onOpen({ x, y, width, height }))} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: triggerColors(tone, expanded || pressed, t).background, borderWidth: 1, borderColor: triggerColors(tone, expanded, t).border, opacity: disabled ? 0.5 : 1 })}><MaterialCommunityIcons name={horizontal ? 'dots-horizontal' : 'dots-vertical'} size={20} color={triggerColors(tone, expanded, t).ink} /></GrowPress></View>;
}

export default function AnchoredActionMenu({ anchor, title, actions, onClose, horizontal = false, tone = 'surface', showTrigger = true }: { anchor: MenuAnchor; title: string; actions: MenuAction[]; onClose(): void; horizontal?: boolean; tone?: TriggerTone; showTrigger?: boolean }) {
  const t = useAppTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const [measuredHeight, setMeasuredHeight] = React.useState(0);
  const dimensions = React.useRef({ width, height });
  React.useEffect(() => {
    if (dimensions.current.width !== width || dimensions.current.height !== height) onClose();
  }, [width, height, onClose]);
  React.useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [progress, reduced]);
  const position = menuPosition(anchor, width, height, measuredHeight || 12 + actions.length * 44 * Math.max(1, fontScale) + actions.filter(action => action.separate).length * 9, insets.top, insets.bottom);
  return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss options" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#07110c33' }} />
      {showTrigger && <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title} options`} onPress={onClose} style={{ position: 'absolute', left: anchor.x, top: anchor.y, width: anchor.width, height: anchor.height, borderRadius: 15, backgroundColor: triggerColors(tone, true, t).background, borderWidth: 1, borderColor: triggerColors(tone, true, t).border, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={horizontal ? 'dots-horizontal' : 'dots-vertical'} size={20} color={triggerColors(tone, true, t).ink} /></Pressable>}
      <Animated.View accessibilityViewIsModal onAccessibilityEscape={onClose} style={{ position: 'absolute', left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [position.opensBelow ? -6 : 6, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }], backgroundColor: t.surface, borderRadius: 18, borderWidth: 1, borderColor: t.border, boxShadow: '0px 12px 30px rgba(0,0,0,0.3)' }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: position.pointer - 5, ...(position.opensBelow ? { top: -6 } : { bottom: -6 }), width: 10, height: 10, backgroundColor: t.surface, borderColor: t.border, borderTopWidth: 1, borderLeftWidth: 1, transform: [{ rotate: position.opensBelow ? '45deg' : '225deg' }] }} />
        <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onContentSizeChange={(_, contentHeight) => setMeasuredHeight(contentHeight)}><View accessibilityRole="menu" accessibilityLabel={`${title} options`} style={{ padding: 6 }}>
          {actions.map(action => <View key={action.label} style={action.separate ? { borderTopWidth: 1, borderTopColor: t.border, marginTop: 4, paddingTop: 4 } : undefined}><Pressable accessibilityRole="menuitem" accessibilityLabel={action.accessibilityLabel || action.label} onPress={() => { onClose(); action.onPress(); }} style={({ pressed }) => ({ minHeight: 44, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? t.elevated : 'transparent' })}><MaterialCommunityIcons name={action.icon} size={21} color={action.danger ? t.danger : t.accent} /><Text style={{ flex: 1, color: action.danger ? t.danger : t.text, fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{action.label}</Text></Pressable></View>)}
        </View></ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
