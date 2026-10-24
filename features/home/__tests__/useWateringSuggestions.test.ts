import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { evaluateWateringInsights } from '@/lib/suggestions/wateringSuggestions';
import { useWateringSuggestions } from '../hooks/useWateringSuggestions';
let mockClock = new Date('2026-10-24T12:00:00Z');
jest.mock('@/hooks/useMinuteClock', () => ({ useMinuteClock: () => mockClock }));
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/features/care/usePlantActivity', () => ({ usePlantActivity: () => ({ logs: {}, loading: false, error: '' }) }));
jest.mock('@/lib/suggestions/wateringSuggestions', () => ({ evaluateWateringInsights: jest.fn() }));
jest.mock('@/lib/logger', () => ({ __esModule: true, default: { error: jest.fn() } }));
it('does not refetch for notes or clock ticks, and exposes an explicit refresh for stale advice', async () => {
  jest.useFakeTimers();
  jest.mocked(evaluateWateringInsights).mockResolvedValue([{ plantId: 'p', plantName: 'Plant', needsWater: true, reason: 'Check soil', weatherFetchedAtMs: mockClock.getTime() }] as any);
  const plant = { id: 'p', name: 'Plant', status: 'active', location: { lat: 1, lng: 2 }, locationTimeZone: 'Africa/Johannesburg' } as any;
  let advice!: ReturnType<typeof useWateringSuggestions>;
  function Probe({ notes = '' }: { notes?: string }) { advice = useWateringSuggestions([{ ...plant, notes }]); return null; }
  let renderer: any;
  await act(async () => { renderer = create(React.createElement(Probe)); });
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(1); expect(advice.plantsNeedingWater).toHaveLength(1);
  mockClock = new Date('2026-10-24T12:05:00Z');
  await act(async () => renderer.update(React.createElement(Probe, { notes: 'Unrelated edit' })));
  await act(async () => { jest.advanceTimersByTime(100); });
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(1);
  await act(async () => advice.refresh()); await act(async () => { jest.advanceTimersByTime(100); });
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(2);
  mockClock = new Date('2026-10-24T19:05:00Z');
  await act(async () => renderer.update(React.createElement(Probe, { notes: 'Another edit' })));
  expect(advice.stale).toBe(true); expect(advice.plantsNeedingWater).toEqual([]);
  expect(evaluateWateringInsights).toHaveBeenCalledTimes(2);
  act(() => renderer.unmount()); jest.useRealTimers();
});
