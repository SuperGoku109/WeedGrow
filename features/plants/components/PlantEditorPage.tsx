import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GrowPress } from '@/ui/GrowMotion';
import { EditorTheme } from './PlantEditorFields';
import type { PlantTheme } from './plantDetailTheme';

export default function PlantEditorPage({ title, subtitle, theme: t, onClose, busy = false, footer, children }: {
  title: string; subtitle?: string; theme: PlantTheme; onClose(): void; busy?: boolean; pending?: boolean; contentGap?: number; footer?: React.ReactNode; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return <EditorTheme.Provider value={t}><SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.background }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={{ borderBottomWidth: 1, borderColor: t.border, paddingHorizontal: 16, paddingVertical: 10 }}>
        <View style={{ width: '100%', maxWidth: 860, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <GrowPress accessibilityRole="button" accessibilityLabel="Back from edit plant" disabled={busy} onPress={onClose} style={{ width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name="arrow-left" size={23} color={t.text} /></GrowPress>
          <View style={{ flex: 1, gap: 2 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 20, fontWeight: '600' }}>{title}</Text>{!!subtitle && <Text style={{ color: t.muted, fontSize: 12 }}>{subtitle}</Text>}</View>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16, paddingBottom: 28 }}><View style={{ width: '100%', maxWidth: 860, alignSelf: 'center', gap: 18 }}>{children}</View></ScrollView>
      {!!footer && <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 14), borderTopWidth: 1, borderColor: t.border, backgroundColor: t.background }}><View style={{ width: '100%', maxWidth: 860, alignSelf: 'center' }}>{footer}</View></View>}
    </KeyboardAvoidingView>
  </SafeAreaView></EditorTheme.Provider>;
}
