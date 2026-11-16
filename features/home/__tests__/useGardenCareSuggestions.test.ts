import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import type { Plant } from '@/firestoreModels';
import { evaluateSuggestionCardsForPlants, type PlantSuggestionResult } from '@/lib/suggestions/suggestionCards';
import { useGardenCareSuggestions } from '../hooks/useGardenCareSuggestions';

jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));
jest.mock('@/hooks/useLocalCareRevision', () => ({ useLocalCareRevision: () => 0 }));
jest.mock('@/lib/suggestions/suggestionCards', () => ({ evaluateSuggestionCardsForPlants: jest.fn() }));

const plant = { id: 'a', name: 'Basil', status: 'active', locationTimeZone: 'Africa/Johannesburg' } as Plant & { id: string };
const evaluate = jest.mocked(evaluateSuggestionCardsForPlants);
let tree: any;
let advice: ReturnType<typeof useGardenCareSuggestions>;
function Probe({ plants = [plant], now = new Date() }: { plants?: typeof plant[]; now?: Date }) {
  advice = useGardenCareSuggestions(plants, now);
  return null;
}
const result = (id = 'a', expires = Date.now() / 1000 + 300) => ({ plantId: id, plantName: id, cards: [{ metrics: { expiresAtUtc: expires } }] } as unknown as PlantSuggestionResult);

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-16T12:00:00Z'));
  evaluate.mockReset().mockImplementation(async () => [result()]);
});
afterEach(() => {
  act(() => tree?.unmount());
  tree = undefined;
  jest.useRealTimers();
});

it('does not reevaluate on minute ticks or unrelated notes, but does when care inputs change', async () => {
  await act(async () => { tree = create(React.createElement(Probe)); });
  expect(evaluate).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(60000); tree.update(React.createElement(Probe, { plants: [{ ...plant, notes: 'A new note' }] })); });
  expect(evaluate).toHaveBeenCalledTimes(1);
  expect(advice.loading).toBe(false);
  await act(async () => tree.update(React.createElement(Probe, { plants: [{ ...plant, careRevision: 2 }] })));
  expect(evaluate).toHaveBeenCalledTimes(2);
});

it('refreshes when advice expires and cancels its timer when unmounted', async () => {
  await act(async () => { tree = create(React.createElement(Probe)); });
  await act(async () => { jest.advanceTimersByTime(300025); });
  expect(evaluate).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
  tree = undefined;
  await act(async () => { jest.advanceTimersByTime(600000); });
  expect(evaluate).toHaveBeenCalledTimes(2);
});

it('ignores late results from an old garden after scope changes', async () => {
  let resolveOld!: (results: PlantSuggestionResult[]) => void;
  evaluate.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce([result('b')]);
  await act(async () => { tree = create(React.createElement(Probe)); });
  const signal = evaluate.mock.calls[0][2]!;
  await act(async () => tree.update(React.createElement(Probe, { plants: [{ ...plant, id: 'b' }] })));
  expect(signal.aborted).toBe(true);
  expect(advice.results[0].plantId).toBe('b');
  await act(async () => resolveOld([result('a')]));
  expect(advice.results[0].plantId).toBe('b');
});

it('reports partial failures and supports explicit retry', async () => {
  evaluate.mockResolvedValueOnce([]);
  await act(async () => { tree = create(React.createElement(Probe)); });
  expect(advice.error).toBe(true);
  await act(async () => advice.refresh());
  expect(advice.error).toBe(false);
  expect(advice.results).toHaveLength(1);
});

it('skips empty, deleted and inactive scopes and clears previous results', async () => {
  await act(async () => { tree = create(React.createElement(Probe)); });
  await act(async () => tree.update(React.createElement(Probe, { plants: [{ ...plant, deleting: true }, { ...plant, id: 'past', status: 'archived' }] })));
  expect(evaluate).toHaveBeenCalledTimes(1);
  expect(advice).toMatchObject({ results: [], loading: false, error: false });
});

it('does not repeatedly retry already expired results', async () => {
  evaluate.mockResolvedValue([result('a', Date.now() / 1000 - 1)]);
  await act(async () => { tree = create(React.createElement(Probe)); });
  await act(async () => { jest.advanceTimersByTime(120000); });
  expect(evaluate).toHaveBeenCalledTimes(1);
});

it('retains completed advice during a focus or explicit refresh', async () => {
  await act(async () => { tree = create(React.createElement(Probe)); });
  const completed = advice.results;
  evaluate.mockImplementation(() => new Promise(() => {}));
  await act(async () => advice.refresh());
  expect(advice.loading).toBe(true);
  expect(advice.results).toBe(completed);
});
