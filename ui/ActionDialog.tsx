import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { GrowPress } from './GrowMotion';
export default function ActionDialog({ title, description, confirmLabel = 'Confirm', onConfirm, onClose, children }: { title: string; description: string; confirmLabel?: string; onConfirm: () => Promise<void>; onClose: () => void; children?: React.ReactNode | ((busy: boolean) => React.ReactNode) }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: '#0009' }}><View accessibilityViewIsModal style={{ backgroundColor: '#23342a', borderRadius: 22, width: '100%', maxWidth: 460, maxHeight: '94%' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
    <Text accessibilityRole="header" style={{ color: '#edf0e3', fontWeight: '700', fontSize: 22 }}>{title}</Text><Text style={{ color: '#b4c4ad', lineHeight: 23 }}>{description}</Text>
    {typeof children === 'function' ? children(busy) : children}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#ffb4ab' }}>{error}</Text>}
    <View style={{ flexDirection: 'row', gap: 18, justifyContent: 'flex-end' }}>
      <GrowPress accessibilityRole="button" disabled={busy} onPress={onClose} style={{ padding: 12 }}><Text style={{ color: '#edf0e3' }}>Cancel</Text></GrowPress>
      <GrowPress accessibilityRole="button" disabled={busy} onPress={async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await onConfirm(); onClose(); } catch (err) { setError(err instanceof Error ? err.message : 'Could not complete this action. Try again.'); } finally { lock.current = false; setBusy(false); } }} style={{ padding: 12 }}><Text style={{ color: '#c8e78b', fontWeight: '700' }}>{busy ? 'Working…' : confirmLabel}</Text></GrowPress>
    </View>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}
