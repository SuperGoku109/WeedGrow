import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { usePlantEditorMutations } from '../hooks/usePlantEditorMutations';
import { updatePlant, deletePlantAndSubcollections } from '../api/plantService';
jest.mock('../api/plantService', () => ({ updatePlant: jest.fn(), deletePlantAndSubcollections: jest.fn() }));
let mutations!: ReturnType<typeof usePlantEditorMutations>;
let renderer: any;
const clear = jest.fn().mockResolvedValue(undefined);
const saved = jest.fn();
const deleted = jest.fn();
const removal = jest.fn();
const build = jest.fn(() => ({ name: 'Updated' }));
const baseline = { name: 'Original' };
function mount() {
  function Probe() {
    mutations = usePlantEditorMutations({ plantId: 'p', draft: { ready: true, saved: null, clear, baseline: { current: baseline } }, guard: { finish: fn => fn(), setRemovalAllowed: removal }, blocked: false, buildUpdates: build, onSaved: saved, onDeleted: deleted });
    return null;
  }
  act(() => { renderer = create(React.createElement(Probe)); });
}
beforeEach(() => { jest.clearAllMocks(); build.mockImplementation(() => ({ name: 'Updated' })); });
afterEach(() => { act(() => renderer?.unmount()); });
it('serializes save and delete, retaining the conflict baseline and one completion', async () => {
  let complete!: () => void;
  jest.mocked(updatePlant).mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
  mount(); let saving!: Promise<void>;
  act(() => { saving = mutations.save(); });
  await act(async () => { await mutations.save(); await mutations.deletePlant(); });
  expect(updatePlant).toHaveBeenCalledTimes(1); expect(updatePlant).toHaveBeenCalledWith('p', { name: 'Updated' }, baseline); expect(deletePlantAndSubcollections).not.toHaveBeenCalled();
  await act(async () => { complete(); await saving; });
  expect(clear).toHaveBeenCalledTimes(1); expect(saved).toHaveBeenCalledTimes(1); expect(mutations.busy).toBe(false);
});
it('validation errors cannot start a write or erase a draft', async () => {
  build.mockImplementation(() => { throw new Error('Enter a plant name.'); });
  mount(); await act(async () => { await mutations.save(); });
  expect(mutations.error).toBe('Enter a plant name.'); expect(updatePlant).not.toHaveBeenCalled(); expect(clear).not.toHaveBeenCalled(); expect(mutations.busy).toBe(false);
});
it('a failed save retains the draft and allows a successful retry', async () => {
  jest.mocked(updatePlant).mockRejectedValueOnce(new Error('Changed elsewhere')).mockResolvedValueOnce(undefined);
  mount(); await act(async () => { await mutations.save(); });
  expect(mutations.error).toBe('Changed elsewhere'); expect(clear).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled();
  await act(async () => { await mutations.save(); });
  expect(mutations.error).toBe(''); expect(saved).toHaveBeenCalledTimes(1); expect(clear).toHaveBeenCalledTimes(1);
});
