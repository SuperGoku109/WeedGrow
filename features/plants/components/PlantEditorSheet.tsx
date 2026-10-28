import { useSlowOperation } from '@/hooks/useSlowOperation';
import CloseButton from '@/ui/CloseButton';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/ui/GrowMotion';
import { EditorTheme } from './PlantEditorFields';
import type { PlantTheme } from './plantDetailTheme';

export default function PlantEditorSheet({ title, subtitle, theme: t, onClose, busy = false, footer, children, scrollRef, contentGap = 16, body, pending = busy }: {
  title: string; subtitle?: string; theme: PlantTheme; onClose(): void; busy?: boolean; footer?: React.ReactNode; children: React.ReactNode; scrollRef?: React.Ref<ScrollView>; contentGap?: number; body?: React.ReactNode; pending?: boolean;
}) {
  const slow = useSlowOperation(pending);
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  return <Modal transparent visible animationType={reduced ? 'none' : 'slide'} onRequestClose={() => { if (!busy) onClose(); }}>
    <EditorTheme.Provider value={t}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#08110ccc', justifyContent: 'flex-end', alignItems: 'center', paddingTop: Math.max(insets.top, 16) }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 620, maxHeight: '100%', flexShrink: 1, backgroundColor: t.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View style={{ width: 36, height: 4, backgroundColor: t.border, borderRadius: 4, alignSelf: 'center', marginBottom: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 22, fontWeight: '700' }}>{title}</Text>{!!subtitle && <Text style={{ color: t.muted, fontSize: 14, marginTop: 4 }}>{subtitle}</Text>}</View><CloseButton label={`Close ${title.toLowerCase()}`} disabled={busy} onPress={onClose} color={t.text} /></View>
        {body ? <>{body}{children}</> : <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={{ flexShrink: 1 }} contentContainerStyle={{ gap: contentGap, paddingBottom: 16 }}>{children}</ScrollView>}
        {slow && <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: 13, paddingVertical: 8 }}>Still working. Keep this screen open while we confirm the result.</Text>}
        {footer && <View style={{ paddingTop: 12, borderTopWidth: 1, borderColor: t.border }}>{footer}</View>}
      </View>
    </KeyboardAvoidingView></EditorTheme.Provider>
  </Modal>;
}
