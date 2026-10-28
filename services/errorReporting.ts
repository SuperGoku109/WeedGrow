import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './authClient';
import { setDiagnosticSink, reportError } from '@/lib/diagnostics/reportError';

type ErrorRuntime = { getGlobalHandler(): (error: Error, fatal?: boolean) => void; setGlobalHandler(handler: (error: Error, fatal?: boolean) => void): void };
export function installErrorReporting() {
  if (__DEV__) return () => {};
  const send = async (event: Record<string, unknown>) => {
    const uid = auth.currentUser?.uid; if (!uid) return;
    const ref = doc(db, 'clientDiagnostics', uid);
    await runTransaction(db, async tx => {
      if (auth.currentUser?.uid !== uid) return;
      const previous = (await tx.get(ref)).data(); const day = Math.floor(Date.now() / 86400000);
      const count = previous?.day === day ? previous.count : 0;
      if (count >= 20) return;
      // One bounded record per account; no messages, stack traces, routes or plant data.
      tx.set(ref, { ...event, day, count: count + 1, lastSeenAt: serverTimestamp() });
    });
  };
  const seen = new Set<string>(); let sent = 0;
  setDiagnosticSink(event => {
    if (!auth.currentUser || sent >= 10) return;
    const key = `${event.operation}:${event.code}:${event.severity}`;
    if (seen.has(key)) return;
    seen.add(key); sent++;
    void send({ ...event, platform: Platform.OS, version: Constants.expoConfig?.version || '1.0.0' }).catch(() => {});
  });
  const error = (event: ErrorEvent) => reportError(event.error, 'unhandled', true);
  const rejection = (event: PromiseRejectionEvent) => reportError(event.reason, 'unhandled');
  const runtime = (globalThis as typeof globalThis & { ErrorUtils?: ErrorRuntime }).ErrorUtils;
  const previous = runtime?.getGlobalHandler();
  const handler = (error: Error, fatal?: boolean) => { reportError(error, 'unhandled', !!fatal); previous?.(error, fatal); };
  if (Platform.OS === 'web' && typeof window !== 'undefined') { window.addEventListener('error', error); window.addEventListener('unhandledrejection', rejection); }
  else runtime?.setGlobalHandler(handler);
  return () => {
    setDiagnosticSink();
    if (Platform.OS === 'web' && typeof window !== 'undefined') { window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', rejection); }
    else if (runtime?.getGlobalHandler() === handler && previous) runtime.setGlobalHandler(previous);
  };
}
