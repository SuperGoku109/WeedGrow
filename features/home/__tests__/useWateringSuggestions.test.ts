import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { evaluateWateringInsights } from '@/lib/suggestions/wateringSuggestions';
import { useWateringSuggestions } from '../hooks/useWateringSuggestions';
let mockClock = new Date('2026-10-24T12:00:00Z');
jest.mock('@/hooks/useMinuteClock', () => ({ useMinuteClock: () => mockClock }));
jest.mock('@/hooks/useLocalCareRevision', () => ({ useLocalCareRevision: () => 0 }));
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/features/care/usePlantActivity', () => ({ usePlantActivity: () => ({ logs: {}, loading: false, error: '' }) }));
jest.mock('@/lib/suggestions/wateringSuggestions', () => ({ evaluateWateringInsights: jest.fn() }));
jest.mock('@/lib/logger', () => ({ __esModule: true, default: { error: jest.fn() } }));
it('does not refetch for notes or clock ticks, and exposes an explicit refresh for stale advice', async () => {
  jest.useFakeTimers();
  mockClock = new Date('2026-10-24T12:00:00Z');
  jest.setSystemTime(mockClock);
  jest.mocked(evaluateWateringInsights).mockResolvedValue([{ plantId: 'p', plantName: 'Plant', needsWater: true, reason: 'Check soil', weatherFetchedAtMs: mockClock.getTime(),
    careEvaluation: { engineVersion: 'hops-8.4.0', policyVersion: 'test', profileVersion: 'test', locationRevision: 1,
      dataRevisionFingerprint: 'test', evaluationUtc: mockClock.getTime() / 1000 + 1, nextEvaluationUtc: mockClock.getTime() / 1000 + 6 * 3600,
      water: { decision: 'water', needsWater: true, reasonCodes: [] } } }] as any);
  const plant = { id: 'p', name: 'Plant', status: 'active', location: { lat: 1, lng: 2 }, locationTimeZone: 'Africa/Johannesburg' } as any;
  let advice!: ReturnType<typeof useWateringSuggestions>;
  function Probe({ notes = '' }: { notes?: string }) { advice = useWateringSuggestions([{ ...plant, notes }]); return null; }
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  // The provider result is newer than the sampled minute clock, but not in the real future.
  jest.setSystemTime(mockClock.getTime() + 2000);
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(1); expect(advice.plantsNeedingWater).toHaveLength(1);
  expect(evaluateWateringInsights).toHaveBeenCalledWith(expect.any(Array), { execution: 'local' }, expect.any(AbortSignal));
  mockClock = new Date('2026-10-24T12:05:00Z');
  jest.setSystemTime(mockClock);
  await act(async () => renderer.update(React.createElement(Probe, { notes: 'Unrelated edit' })));
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(1);
  await act(async () => advice.refresh()); await act(async () => { jest.advanceTimersByTime(100); });
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(2);
  mockClock = new Date('2026-10-24T19:05:00Z');
  jest.setSystemTime(mockClock);
  await act(async () => renderer.update(React.createElement(Probe, { notes: 'Another edit' })));
  expect(advice.stale).toBe(true); expect(advice.plantsNeedingWater).toEqual([]);
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(2);
  act(() => renderer.unmount()); jest.useRealTimers();
});

it('automatically refreshes observation advice when its validity ends', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T12:00:00Z'));
  mockClock = new Date();
  jest.mocked(evaluateWateringInsights).mockImplementation(async () => [{ plantId: 'p', plantName: 'Plant', reason: 'Check soil', careEvaluation: {
    engineVersion: 'hops-8.4.0', policyVersion: 'outdoor-observation-v1', profileVersion: 'observation-rules-v1', locationRevision: 0, dataRevisionFingerprint: 'test',
    evaluationUtc: Date.now() / 1000, nextEvaluationUtc: Date.now() / 1000 + 300, water: { needsWater: null, decision: 'uncertain', reasonCodes: [] },
    outdoor: { checkStatus: 'CHECK_NOW', recommendations: [] },
  } }] as any);
  function Probe() { useWateringSuggestions([{ id: 'p', owners: ['owner'], name: 'Plant', status: 'active' } as any]); return null; }
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(300100); });
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(2);
  act(() => renderer.unmount()); jest.useRealTimers();
});
