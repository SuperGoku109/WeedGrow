import { reportError } from '@/lib/diagnostics/reportError';
import { saveErrorMessage } from '@/lib/errors/saveFeedback';
import { useSlowOperation } from '@/hooks/useSlowOperation';
import CloseButton from './CloseButton';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';
import { GrowPress } from './GrowMotion';
export default function ActionDialog({ title, description, confirmLabel = 'Confirm', onConfirm, onClose, children, confirmDisabled = false, danger = false }: { title: string; description: string; danger?: boolean; confirmLabel?: string; confirmDisabled?: boolean; onConfirm: () => Promise<void>; onClose: () => void; children?: React.ReactNode | ((busy: boolean) => React.ReactNode) }) {
  const [busy, setBusy] = React.useState(false);
  const slow = useSlowOperation(busy);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!busy) onClose(); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 22, backgroundColor: '#0009' }}><View accessibilityViewIsModal style={{ backgroundColor: '#23342a', borderRadius: 22, width: '100%', maxWidth: 460, maxHeight: '94%' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 24, paddingRight: 16, paddingTop: 16 }}><Text accessibilityRole="header" style={{ flex: 1, color: '#edf0e3', fontWeight: '700', fontSize: 22 }}>{title}</Text><CloseButton label={`Close ${title.toLowerCase()}`} disabled={busy} onPress={onClose} /></View><ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}>
    <Text style={{ color: '#b4c4ad', lineHeight: 23 }}>{description}</Text>
    {typeof children === 'function' ? children(busy) : children}
    {slow && <Text accessibilityLiveRegion="polite" style={{ color: '#b4c4ad', lineHeight: 23 }}>Still working. Keep this screen open while we confirm the result.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#ffb4ab' }}>{error}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'flex-end' }}>
      <GrowPress accessibilityRole="button" disabled={busy} onPress={onClose} style={{ minHeight: 48, padding: 14, borderWidth: 1, borderColor: '#7b8e72', borderRadius: 12, justifyContent: 'center' }}><Text style={{ color: '#edf0e3', fontSize: 16 }}>Cancel</Text></GrowPress>
      <GrowPress accessibilityRole="button" accessibilityState={{ busy }} disabled={busy || confirmDisabled} onPress={async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await onConfirm(); onClose(); } catch (err) { reportError(err, 'save'); setError(saveErrorMessage(err, 'Could not complete this action. Try again.')); } finally { lock.current = false; setBusy(false); } }} style={{ minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: danger ? '#ffb4ab' : '#c8e78b', opacity: busy || confirmDisabled ? 0.6 : 1, justifyContent: 'center' }}><Text style={{ color: danger ? '#601410' : '#243420', fontSize: 16, fontWeight: '700' }}>{busy ? 'Working…' : error ? 'Try again' : confirmLabel}</Text></GrowPress>
    </View>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}
