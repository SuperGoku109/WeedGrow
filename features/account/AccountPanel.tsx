import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { syncReminders } from '@/services/reminders';
import { auth } from '@/services/authClient';
import { accountError, useSession } from '@/services/session';
import { Field, Press, palette, s } from '@/features/addPlant/components/FlowUI';

export default function AccountPanel() {
  const { user } = useSession();
  const [mode, setMode] = React.useState<'signin' | 'create' | 'reset'>('signin');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);
  const submit = async () => {
    if (lock.current) return;
    if (!email.trim() || !email.includes('@')) { setMessage('Enter your email address.'); return; }
    if (mode !== 'reset' && (!password || mode === 'create' && password.length < 8)) { setMessage(mode === 'create' ? 'Use a password with at least 8 characters.' : 'Enter your password.'); return; }
    lock.current = true; setBusy(true); setMessage('');
    try {
      if (mode === 'reset') { await sendPasswordResetEmail(auth, email.trim()); setMessage('If an account exists for that address, a reset email has been sent.'); }
      else if (mode === 'create') await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (error) { setMessage(accountError(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  if (user) return <View style={{ gap: 16 }}><Text style={s.sectionTitle}>Your garden account</Text><Text style={s.hint}>{user.email}</Text><Text style={s.hint}>Plants you add are linked to this account. You can sign in on another device to access them.</Text><Press label="Sign out" disabled={busy} onPress={async () => { setBusy(true); try { await syncReminders(undefined, [], false); await signOut(auth); } catch (error) { setMessage(accountError(error)); } finally { setBusy(false); } }} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Sign out</Text></Press>{!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}</View>;
  return <View style={{ gap: 18 }}>
    <Text style={s.sectionTitle}>{mode === 'create' ? 'Create your garden account' : mode === 'reset' ? 'Reset your password' : 'Sign in to your garden'}</Text>
    <Text style={s.hint}>An account keeps your plants separate from other people’s gardens. Your local draft stays on this device until you save.</Text>
    <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} />
    {mode !== 'reset' && <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'create' ? 'new-password' : 'current-password'} editable={!busy} onSubmitEditing={() => void submit()} hint={mode === 'create' ? 'At least 8 characters. Use a unique password.' : undefined} />}
    {!!message && <Text accessibilityRole="alert" style={s.error}>{message}</Text>}
    <Press label={mode === 'create' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in'} disabled={busy} onPress={() => void submit()} style={s.button}>{busy && <ActivityIndicator color={palette.dark} />}<Text style={s.buttonText}>{busy ? 'Connecting…' : mode === 'create' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in'}</Text></Press>
    <Press label={mode === 'signin' ? 'Create an account instead' : 'Back to sign in'} disabled={busy} onPress={() => { setMode(mode === 'signin' ? 'create' : 'signin'); setMessage(''); setPassword(''); }} style={{ padding: 12 }}><Text style={{ color: palette.accent }}>{mode === 'signin' ? 'Create an account' : 'Back to sign in'}</Text></Press>
    {mode === 'signin' && <Press label="Forgot password" disabled={busy} onPress={() => { setMode('reset'); setMessage(''); setPassword(''); }} style={{ padding: 12 }}><Text style={s.hint}>Forgot password?</Text></Press>}
  </View>;
}
