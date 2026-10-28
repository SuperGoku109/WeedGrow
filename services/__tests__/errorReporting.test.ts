import { installErrorReporting } from '../errorReporting';
import { reportError } from '@/lib/diagnostics/reportError';
import { runTransaction } from 'firebase/firestore';
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('../authClient', () => ({ auth: { currentUser: { uid: 'owner' } } }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(() => 'diagnostic-owner'), runTransaction: jest.fn(), serverTimestamp: () => 'server-time' }));
const runtime = globalThis as typeof globalThis & { __DEV__: boolean; ErrorUtils?: { getGlobalHandler(): (error: Error, fatal?: boolean) => void; setGlobalHandler(handler: (error: Error, fatal?: boolean) => void): void } };
const originalDev = __DEV__; const originalRuntime = runtime.ErrorUtils;
let stop: (() => void) | undefined;
const write = jest.fn(); const originalHandler = jest.fn();
let handler = originalHandler as (error: Error, fatal?: boolean) => void;
beforeEach(() => {
  runtime.__DEV__ = false; handler = originalHandler;
  runtime.ErrorUtils = { getGlobalHandler: () => handler, setGlobalHandler: value => { handler = value; } };
  jest.mocked(runTransaction).mockImplementation(async (_db, body) => body({ get: async () => ({ data: () => undefined }), set: write } as never));
});
afterEach(() => { stop?.(); stop = undefined; runtime.__DEV__ = originalDev; runtime.ErrorUtils = originalRuntime; });
it('sends only sanitized fields, deduplicates repeated errors and preserves the native handler', async () => {
  stop = installErrorReporting(); const error = Object.assign(new Error('Private plant note'), { code: 'firestore/unavailable' });
  handler(error, true); handler(error, true); await Promise.resolve(); await Promise.resolve();
  expect(originalHandler).toHaveBeenCalledTimes(2); expect(runTransaction).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith('diagnostic-owner', expect.objectContaining({ operation: 'unhandled', code: 'unavailable', severity: 'fatal', count: 1, platform: 'android' }));
  expect(JSON.stringify(write.mock.calls)).not.toContain('Private');
  stop(); stop = undefined; expect(handler).toBe(originalHandler);
});
it('retains the server counter cap and does not emit development reports', async () => {
  jest.mocked(runTransaction).mockImplementation(async (_db, body) => body({ get: async () => ({ data: () => ({ day: Math.floor(Date.now()/86400000), count: 20 }) }), set: write } as never));
  stop = installErrorReporting(); reportError(new Error('x'), 'save'); await Promise.resolve(); await Promise.resolve();
  expect(write).not.toHaveBeenCalled(); stop();
  runtime.__DEV__ = true; stop = installErrorReporting(); reportError(new Error('x'), 'save');
  expect(runTransaction).toHaveBeenCalledTimes(1);
});
