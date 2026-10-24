import { resetLiveStores } from '@/lib/data/liveStore';
import { useSyncExternalStore } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './authClient';

export function requireUserId(): string {
  if (!auth.currentUser) throw new Error('Sign in to save this plant to your garden. Your draft is safe on this device.');
  return auth.currentUser.uid;
}
let cacheOwner = auth.currentUser?.uid || null;
const pendingSession = { user: null as User | null, loading: true };
let session = { user: auth.currentUser as User | null, loading: true };
const listeners = new Set<() => void>();
let stopAuth: (() => void) | undefined;
function publishSession(user: User | null) {
  const uid = user?.uid || null;
  if (uid !== cacheOwner) { cacheOwner = uid; resetLiveStores(); }
  session = { user, loading: false }; listeners.forEach(notify => notify());
}
function subscribeSession(notify: () => void) {
  listeners.add(notify);
  if (!stopAuth) stopAuth = onAuthStateChanged(auth, publishSession, () => publishSession(auth.currentUser));
  return () => { listeners.delete(notify); if (!listeners.size) { stopAuth?.(); stopAuth = undefined; } };
}
function getSession() {
  // Auth may change while no screens are mounted. Never expose the former
  // account during the render before the new auth listener is attached.
  if (session.user !== auth.currentUser) session = { user: auth.currentUser, loading: true };
  return session;
}
export function useSession() { return useSyncExternalStore(subscribeSession, getSession, () => pendingSession); }
export function accountError(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (['auth/configuration-not-found', 'auth/operation-not-allowed', 'auth/admin-restricted-operation'].includes(code || '')) return 'Sign-in is not enabled for this project yet. Enable Email/Password in Firebase Authentication, then try again. Your draft has been kept.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code || '')) return 'The email or password is incorrect.';
  if (code === 'auth/email-already-in-use') return 'An account already uses this email. Choose Sign in instead.';
  if (code === 'auth/weak-password') return 'Use a stronger password with at least 8 characters.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment and try again.';
  if (code === 'auth/network-request-failed') return 'Could not connect. Check your connection and try again.';
  return 'Could not complete sign-in. Please try again.';
}
