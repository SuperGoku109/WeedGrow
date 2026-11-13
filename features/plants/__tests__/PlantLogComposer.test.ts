import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import Composer from '../components/PlantLogComposer';
import Sheet from '../components/PlantEditorSheet';
import { EditorField } from '../components/PlantEditorFields';
import PlantDateField from '../components/PlantDateField';
import { plantThemes } from '../components/plantDetailTheme';
import { journalRevision } from '@/lib/logs/journalMutation';
import { newLogId, readJournalEntry } from '@/lib/logs/journalRepository';
import { readJournalDraft, writeJournalDraft, clearJournalDraft } from '@/lib/logs/journalDraft';
import { rememberWateringAmount } from '@/services/wateringAmount';
let mockRememberedAmount = '';
jest.mock('@/hooks/useRememberedWateringAmount', () => ({ useRememberedWateringAmount: () => mockRememberedAmount }));
jest.mock('@/services/wateringAmount', () => ({ rememberWateringAmount: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/lib/logs/journalRepository', () => ({ newLogId: jest.fn(() => 'request'), readJournalEntry: jest.fn() }));
jest.mock('@/lib/logs/journalDraft', () => ({ journalDraftKey: () => 'draft', readJournalDraft: jest.fn(), writeJournalDraft: jest.fn().mockResolvedValue(undefined), clearJournalDraft: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, GrowCollapse: ({ open, children }: any) => open ? children : null, GrowRotate: ({ children }: any) => children }));
jest.mock('@/services/wateringRoutine', () => ({ stopWateringRoutine: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/ui/ActionDialog', () => () => null);
jest.mock('../components/PlantEditorSheet', () => ({ __esModule: true, default: ({ children, footer }: any) => { const React = jest.requireActual('react'); const { View } = jest.requireActual('react-native'); return React.createElement(View, null, children, footer); } }));
jest.mock('../components/PlantEditorFields', () => ({ EditorField: () => null }));
jest.mock('../components/PlantDateField', () => ({ __esModule: true, default: () => null, displayDay: (value: string) => value }));
let renderer: any;
const save = jest.fn(); const saved = jest.fn(); const close = jest.fn();
const props = { plantId: 'plant', name: 'Plant', initialDate: '2026-10-27', initialCategory: 'watering' as const, theme: plantThemes.grove, onSave: save, onSaved: saved, onClose: close };
const button = (label: string) => renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const field = (label: string) => renderer.root.findAllByType(EditorField).find((node: any) => node.props.label === label);
async function mount(extra = {}) { await act(async () => { renderer = create(React.createElement(Composer, { ...props, ...extra })); }); }
beforeEach(() => { mockRememberedAmount = ''; jest.clearAllMocks(); jest.mocked(readJournalDraft).mockResolvedValue(null); save.mockResolvedValue({ id: 'entry', mutationId: 'request' }); jest.mocked(writeJournalDraft).mockResolvedValue(undefined); jest.mocked(clearJournalDraft).mockResolvedValue(undefined); jest.mocked(newLogId).mockReturnValue('request'); jest.mocked(readJournalEntry).mockReset(); });
afterEach(() => act(() => renderer?.unmount()));
it('ignores old activity drafts and opens immediately', async () => {
  jest.mocked(readJournalDraft).mockResolvedValue({ version: 1, requestId: 'old', category: 'watering', date: '2026-10-26', description: '', measurements: { waterMl: '500' } });
  await mount();
  expect(button('Save watering')).toBeDefined(); expect(field('Water amount')).toBeUndefined();
  expect(readJournalDraft).not.toHaveBeenCalled();
  expect(JSON.stringify(renderer.toJSON())).not.toMatch(/draft|Resume activity|Checking saved/i);
});
it.each(['watering', 'feeding', 'pests', 'health', 'training', 'measurements', 'repotting', 'flushing', 'notes'] as const)('discards unfinished %s immediately on close without saving or prompting', async initialCategory => {
  await mount({ initialCategory });
  if (initialCategory === 'watering') {
    await act(async () => button('Water amount').props.onPress());
    await act(async () => field('Water amount').props.onChangeText('500'));
  } else {
    const observation = renderer.root.findAllByType(EditorField).find((node: any) => /Observation|Note/.test(node.props.label));
    await act(async () => observation.props.onChangeText('Unfinished activity'));
  }
  await act(async () => renderer.root.findByType(Sheet).props.onClose());
  expect(close).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled();
  expect(readJournalDraft).not.toHaveBeenCalled(); expect(writeJournalDraft).not.toHaveBeenCalled(); expect(clearJournalDraft).not.toHaveBeenCalled();
  act(() => renderer.unmount()); await mount({ initialCategory });
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Unfinished activity');
  if (initialCategory === 'watering') expect(field('Water amount')).toBeUndefined();
});
it('keeps watering minimal and puts readings in a separate activity', async () => {
  await mount();
  expect(field('Water amount')).toBeUndefined(); expect(field('pH')).toBeUndefined(); expect(button('Additional measurements')).toBeUndefined();
  await act(async () => button('Save watering').props.onPress());
  expect(save).toHaveBeenCalledWith('watering', '', '2026-10-27', {}, 'request', expect.anything());
});
it('quietly reuses the last amount without opening inputs or creating a draft', async () => {
  mockRememberedAmount = '250';
  await mount();
  expect(JSON.stringify(renderer.toJSON())).toContain('Using last amount');
  expect(field('Water amount')).toBeUndefined(); expect(writeJournalDraft).not.toHaveBeenCalled();
  await act(async () => button('Save watering').props.onPress());
  expect(save).toHaveBeenCalledWith('watering', '', '2026-10-27', { waterMl: 250 }, 'request', expect.anything());
  expect(rememberWateringAmount).toHaveBeenCalledWith('owner', 'plant', 250);
});
it('can clear a reused amount and does not replace it again', async () => {
  mockRememberedAmount = '250'; await mount();
  await act(async () => button('Water amount').props.onPress());
  await act(async () => button('Remove water amount').props.onPress());
  expect(button('Water amount').props.accessibilityState.expanded).toBe(true);
  expect(field('Water amount').props.value).toBe('');
  await act(async () => button('Save watering').props.onPress());
  expect(save).toHaveBeenCalledWith('watering', '', '2026-10-27', {}, 'request', expect.anything());
});
it('uses the heading to collapse and reopen without clearing the amount', async () => {
  await mount();
  await act(async () => button('Water amount').props.onPress());
  await act(async () => field('Water amount').props.onChangeText('250'));
  await act(async () => button('Water amount').props.onPress());
  expect(button('Water amount').props.accessibilityState.expanded).toBe(false);
  expect(field('Water amount')).toBeUndefined();
  expect(JSON.stringify(renderer.toJSON())).toContain('250 ml');
  await act(async () => button('Water amount').props.onPress());
  expect(field('Water amount').props.value).toBe('250');
});
it('does not replace an existing activity amount with the remembered default', async () => {
  mockRememberedAmount = '250';
  await mount({ entry: { id: 'old', type: 'watering', waterMl: 100 } });
  expect(field('Water amount').props.value).toBe('100');
});
it('offers measurements directly in their own activity', async () => {
  await mount({ initialCategory: 'measurements' });
  expect(field('pH')).toBeDefined(); expect(field('Height')).toBeDefined(); expect(field('Soil moisture')).toBeDefined();
  await act(async () => field('Height').props.onChangeText('30'));
  await act(async () => button('Save measurements').props.onPress());
  expect(save).toHaveBeenCalledWith('measurements', 'Measurements recorded.', '2026-10-27', { heightCm: 30 }, 'request', expect.anything());
});
it.each(['repotting', 'flushing'] as const)('saves %s with only a date and optional observation', async initialCategory => {
  await mount({ initialCategory });
  expect(field('Observation (optional)')).toBeDefined();
  for (const label of ['pH', 'Height', 'Soil moisture', 'Water amount']) expect(field(label)).toBeUndefined();
  await act(async () => button(`Save ${initialCategory}`).props.onPress());
  expect(save).toHaveBeenCalledWith(initialCategory, '', '2026-10-27', {}, 'request', expect.anything());
});
it('opens the dedicated harvest flow with the chosen date instead of saving a generic log', async () => {
  const harvest = jest.fn();
  await mount({ initialCategory: undefined, onHarvest: harvest });
  await act(async () => button('Log Harvesting').props.onPress());
  expect(harvest).toHaveBeenCalledWith('2026-10-27'); expect(save).not.toHaveBeenCalled();
});
it.each(['feeding', 'pests', 'training', 'health', 'notes'] as const)('keeps general measurements out of %s', async initialCategory => {
  await mount({ initialCategory });
  expect(button('Additional measurements')).toBeUndefined();
  for (const label of ['pH', 'Height', 'Soil moisture']) expect(field(label)).toBeUndefined();
  if (initialCategory === 'feeding') expect(field('Nutrient dose')).toBeDefined();
});
it('does not attach measurement values when switching to another activity', async () => {
  await mount({ initialCategory: 'measurements' });
  await act(async () => field('pH').props.onChangeText('6.5'));
  await act(async () => button('Change activity type').props.onPress());
  await act(async () => button('Log Feeding').props.onPress());
  await act(async () => button('Save feeding').props.onPress());
  expect(save).toHaveBeenCalledWith('feeding', '', '2026-10-27', {}, 'request', expect.anything());
});
it('returns from the type chooser with the activity and entered details intact', async () => {
  await mount(); await act(async () => button('Water amount').props.onPress()); await act(async () => field('Water amount').props.onChangeText('500'));
  await act(async () => button('Change activity type').props.onPress());
  expect(button('Save watering')).toBeUndefined();
  await act(async () => button('Back to activity details').props.onPress());
  expect(field('Water amount').props.value).toBe('500');
  expect(button('Save watering')).toBeDefined();
});
it('shows field validation without attempting a save', async () => {
  await mount(); await act(async () => button('Water amount').props.onPress()); await act(async () => field('Water amount').props.onChangeText('-1'));
  await act(async () => button('Save watering').props.onPress());
  expect(save).not.toHaveBeenCalled(); expect(field('Water amount').props.error).toContain('between');
});
it('prevents double submission and keeps inputs locked while saving', async () => {
  let finish!: () => void; save.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  await mount(); await act(async () => { void button('Save watering').props.onPress(); void button('Save watering').props.onPress(); });
  expect(save).toHaveBeenCalledTimes(1); expect(renderer.root.findByType(Sheet).props.busy).toBe(true);
  await act(async () => finish());
});
it('keeps values and the retry identifier after a failed save', async () => {
  save.mockRejectedValueOnce(new Error('Offline'));
  await mount(); await act(async () => button('Water amount').props.onPress()); await act(async () => field('Water amount').props.onChangeText('250'));
  await act(async () => button('Save watering').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('Activity wasn’t saved'); expect(field('Water amount').props.value).toBe('250');
  await act(async () => button('Save watering').props.onPress());
  expect(save).toHaveBeenNthCalledWith(2, 'watering', '', '2026-10-27', expect.objectContaining({ waterMl: 250 }), 'request', expect.anything());
});
it('disables unchanged edits and keeps a changed date only while open', async () => {
  await mount({ entry: { id: 'entry', description: '', type: 'watering' } });
  expect(button('Save activity changes').props.disabled).toBe(true);
  await act(async () => renderer.root.findByType(PlantDateField).props.onChange('2026-10-26'));
  expect(button('Save activity changes').props.disabled).toBe(false);
});

const currentEntry = { id: 'entry', type: 'note', category: 'notes', description: 'First', calendarDay: '2026-10-27', updatedBy: 'owner', mutationId: 'original', timestamp: { toDate: () => new Date('2026-10-27T12:00:00Z') } } as any;
it('acknowledges the original payload before saving revised values with a new mutation id', async () => {
  jest.mocked(newLogId).mockReturnValueOnce('original').mockReturnValue('corrected');
  save.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ id: 'entry', mutationId: 'original' }).mockResolvedValueOnce({ id: 'entry', mutationId: 'corrected' });
  jest.mocked(readJournalEntry).mockResolvedValue(currentEntry);
  await mount({ initialCategory: 'notes' });
  await act(async () => field('Note').props.onChangeText('First'));
  await act(async () => button('Save note').props.onPress());
  await act(async () => field('Note').props.onChangeText('Revised'));
  await act(async () => button('Save note').props.onPress());
  expect(save.mock.calls[1][1]).toBe('First'); expect(save.mock.calls[1][4]).toBe('original');
  expect(save.mock.calls[2][1]).toBe('Revised'); expect(save.mock.calls[2][4]).toBe('corrected');
  expect(save.mock.calls[2][5]).toEqual({ entry: currentEntry, baseline: journalRevision(currentEntry) });
  expect(saved).toHaveBeenCalledTimes(1);
});
it('opens soil checking directly on moisture input without recording watering', async () => {
  await mount({ initialCategory: 'health', initialContext: 'soil-check' });
  expect(button('Soil feels dry')).toBeDefined(); expect(button('Soil feels moist')).toBeDefined(); expect(button('Soil feels wet')).toBeDefined(); expect(field('Water amount')).toBeUndefined(); expect(field('pH')).toBeUndefined();
});
it('offers known watering history before another watering form is filled', async () => {
  const watering = { ...currentEntry, type: 'watering', category: 'watering' };
  await mount({ knownWaterings: { '2026-10-27': watering }, onOpenEntry: jest.fn() });
  expect(button('Save watering')).toBeUndefined(); expect(field('Water amount')).toBeUndefined(); expect(button('Edit existing watering')).toBeDefined();
});

it('saves a categorical root-zone observation without fabricating a percentage or watering', async () => {
  await mount({ initialCategory: 'health', initialContext: 'soil-check', configuration: 'setup-1' });
  await act(async () => button('Soil feels moist').props.onPress());
  await act(async () => button('Save soil check').props.onPress());
  expect(save).toHaveBeenCalledWith('health', expect.any(String), expect.any(String), { moistureState: 'MOIST', moistureConfiguration: 'setup-1' }, expect.any(String), expect.any(Object));
});

it('saves user-confirmed rain as a health observation rather than watering', async () => {
  await mount({ initialCategory: 'health' });
  await act(async () => button('Reported heavy rain').props.onPress());
  await act(async () => button('Save health check').props.onPress());
  expect(save).toHaveBeenCalledWith('health', expect.any(String), expect.any(String), { rainfallObservation: 'HEAVY' }, expect.any(String), expect.any(Object));
});

it('keeps watering free of note inputs and saves notes separately for the selected date', async () => {
  await mount();
  expect(field('Observation (optional)')).toBeUndefined();
  expect(field('Note')).toBeUndefined();
  await act(async () => button('Change activity type').props.onPress());
  await act(async () => button('Log Note').props.onPress());
  await act(async () => field('Note').props.onChangeText('New leaves today'));
  await act(async () => button('Save note').props.onPress());
  expect(save).toHaveBeenCalledWith('notes', 'New leaves today', '2026-10-27', {}, 'request', expect.anything());
});
it('does not attach a separate note when switching to watering', async () => {
  await mount({ initialCategory: 'notes' });
  await act(async () => field('Note').props.onChangeText('Keep this as a note'));
  await act(async () => button('Change activity type').props.onPress());
  await act(async () => button('Log Watering').props.onPress());
  await act(async () => button('Save watering').props.onPress());
  expect(save).toHaveBeenCalledWith('watering', '', '2026-10-27', {}, 'request', expect.anything());
});
it('preserves legacy watering descriptions when correcting the amount', async () => {
  await mount({ entry: { id: 'old', type: 'watering', description: 'Previously saved note', waterMl: 250 } });
  expect(field('Observation (optional)')).toBeUndefined();
  await act(async () => field('Water amount').props.onChangeText('500'));
  await act(async () => button('Save activity changes').props.onPress());
  expect(save).toHaveBeenCalledWith('watering', 'Previously saved note', '2026-10-27', expect.objectContaining({ waterMl: 500 }), 'request', expect.anything());
});
