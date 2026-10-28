import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import Editor from '../components/PlantSectionEditor';
import ActionDialog from '@/ui/ActionDialog';
import PlantActionButton from '../components/PlantActionButton';
import { deletePlantAndSubcollections, updatePlant } from '../api/plantService';
import type { Plant } from '@/firestoreModels';
const mockClear = jest.fn().mockResolvedValue(undefined);
const mockRemoval = jest.fn();
jest.mock('../api/plantService', () => ({ deletePlantAndSubcollections: jest.fn(), updatePlant: jest.fn() }));
jest.mock('@/ui/useEditDraft', () => ({ useEditDraft: () => ({ ready: true, saved: null, baseline: { current: {} }, clear: mockClear }), DraftRecovery: () => null }));
jest.mock('@/ui/useDiscardGuard', () => ({ useDiscardGuard: () => ({ requestClose: (fn: () => void) => fn(), finish: (fn: () => void) => fn(), setRemovalAllowed: mockRemoval, dialog: null }) }));
jest.mock('@/features/addPlant/api/environmentApi', () => ({ fetchSensorProfiles: jest.fn().mockResolvedValue([]) }));
jest.mock('../components/PlantEditorSheet', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../components/PlantEditorFields', () => ({ EditorField: () => null, EditorSelect: () => null }));
jest.mock('../components/EditorGroup', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../components/EditorPotSize', () => () => null);
jest.mock('../components/PlantDateField', () => ({ __esModule: true, default: () => null, displayDay: () => '' }));
jest.mock('@/features/location/PlantLocationEditor', () => () => null);
jest.mock('../components/PlantActionButton', () => () => null);
jest.mock('@/ui/ActionDialog', () => () => null);
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable }));
let renderer: any;
const deleted = jest.fn();
async function mount() { await act(async () => { renderer = create(React.createElement(Editor, { plantId: 'p1', plant: { name: 'Milkshake', status: 'active', environment: 'outdoor', growthStage: 'seedling' } as Plant, section: 'All', onClose: jest.fn(), onSaved: jest.fn(), onDeleted: deleted })); }); }
function open() { act(() => renderer.root.findByType(PlantActionButton).props.onPress()); }
beforeEach(() => { jest.clearAllMocks(); jest.mocked(deletePlantAndSubcollections).mockResolvedValue(undefined); });
afterEach(() => { act(() => renderer?.unmount()); });
test('delete requires confirmation and cancellation does not write or clear edits', async () => {
  await mount(); open();
  const dialog = renderer.root.findByType(ActionDialog);
  expect(dialog.props.description).toContain('Milkshake'); expect(dialog.props.description).toContain('cannot be undone'); expect(dialog.props.danger).toBe(true);
  act(() => dialog.props.onClose());
  expect(deletePlantAndSubcollections).not.toHaveBeenCalled(); expect(updatePlant).not.toHaveBeenCalled(); expect(mockClear).not.toHaveBeenCalled(); expect(deleted).not.toHaveBeenCalled();
});
test('confirmed deletion clears the draft and returns to the plant list', async () => {
  await mount(); open(); await act(async () => { await renderer.root.findByType(ActionDialog).props.onConfirm(); });
  expect(deletePlantAndSubcollections).toHaveBeenCalledWith('p1'); expect(mockClear).toHaveBeenCalledTimes(1); expect(deleted).toHaveBeenCalledTimes(1); expect(updatePlant).not.toHaveBeenCalled();
});
test('failed deletion keeps the editor and draft and restores the discard guard', async () => {
  jest.mocked(deletePlantAndSubcollections).mockRejectedValueOnce(new Error('Offline'));
  await mount(); open(); await act(async () => { await expect(renderer.root.findByType(ActionDialog).props.onConfirm()).rejects.toThrow('Offline'); });
  expect(mockClear).not.toHaveBeenCalled(); expect(deleted).not.toHaveBeenCalled(); expect(mockRemoval).toHaveBeenLastCalledWith(false);
  expect(renderer.root.findByType(ActionDialog)).toBeDefined();
});
