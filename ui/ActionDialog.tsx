import { reportError } from '@/lib/diagnostics/reportError';
import { saveErrorMessage } from '@/lib/errors/saveFeedback';
import { useSlowOperation } from '@/hooks/useSlowOperation';
import CloseButton from './CloseButton';
import AnimatedModal from './AnimatedModal';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { GrowPress } from './GrowMotion';
export default function ActionDialog({ title, description, confirmLabel = 'Confirm', onConfirm, onClose, children, confirmDisabled = false, danger = false, singleAction = false }: { title: string; description: React.ReactNode; danger?: boolean; singleAction?: boolean; confirmLabel?: string; confirmDisabled?: boolean; onConfirm: () => Promise<void>; onClose: () => void; children?: React.ReactNode | ((busy: boolean) => React.ReactNode) }) {
  const [busy, setBusy] = React.useState(false);
  const slow = useSlowOperation(busy);
  const [error, setError] = React.useState('');
  const lock = React.useRef(false);
  return <AnimatedModal deferClose placement="center" disabled={busy} onClose={onClose}>{(close, closing) => <View style={{ backgroundColor: '#23342a', borderRadius: 24, width: '100%', maxHeight: '100%', flexShrink: 1, borderWidth: 1, borderColor: '#40543d', boxShadow: '0px 20px 60px rgba(0,0,0,0.3)' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 24, paddingRight: 16, paddingTop: 16 }}><Text accessibilityRole="header" style={{ flex: 1, color: '#edf0e3', fontWeight: '700', fontSize: 22 }}>{title}</Text><CloseButton label={`Close ${title.toLowerCase()}`} disabled={busy || closing} onPress={close} /></View><ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingTop: singleAction ? 8 : 24, gap: 18 }}>
    {typeof description === 'string' ? <Text style={{ color: '#b4c4ad', lineHeight: 23 }}>{description}</Text> : description}
    {typeof children === 'function' ? children(busy || closing) : children}
    {slow && <Text accessibilityLiveRegion="polite" style={{ color: '#b4c4ad', lineHeight: 23 }}>Still working. Keep this screen open while we confirm the result.</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#ffb4ab' }}>{error}</Text>}
    <View style={{ flexDirection: singleAction ? 'column' : 'row', flexWrap: singleAction ? 'nowrap' : 'wrap', gap: 12, justifyContent: 'flex-end' }}>
      {!singleAction && <GrowPress accessibilityRole="button" disabled={busy || closing} onPress={close} style={{ minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#7b8e72', borderRadius: 12, justifyContent: 'center' }}><Text style={{ color: '#edf0e3', fontSize: 14 }}>Cancel</Text></GrowPress>}
      <GrowPress accessibilityRole="button" accessibilityState={{ busy }} disabled={busy || closing || confirmDisabled} onPress={async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await onConfirm(); close(); } catch (err) { reportError(err, 'save'); setError(saveErrorMessage(err, 'Could not complete this action. Try again.')); } finally { lock.current = false; setBusy(false); } }} style={{ alignItems: 'center', minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: danger ? '#ffb4ab' : '#c8e78b', opacity: busy || confirmDisabled ? 0.6 : 1, justifyContent: 'center' }}><Text style={{ color: danger ? '#601410' : '#243420', fontSize: 14, fontWeight: '700' }}>{busy ? 'Working…' : error ? 'Try again' : confirmLabel}</Text></GrowPress>
    </View>
  </ScrollView></View>}</AnimatedModal>;
}
