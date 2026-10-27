import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import Composer from '../components/PlantLogComposer';
import Sheet from '../components/PlantEditorSheet';
import { EditorField } from '../components/PlantEditorFields';
import PlantDateField from '../components/PlantDateField';
import { plantThemes } from '../components/plantDetailTheme';
import { journalRevision } from '@/lib/logs/journalMutation';
import { inspectJournalDraft } from '@/lib/logs/journalRecovery';
import { newLogId, readJournalEntry } from '@/lib/logs/journalRepository';
import { readJournalDraft, writeJournalDraft, clearJournalDraft } from '@/lib/logs/journalDraft';
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/lib/logs/journalRepository', () => ({ newLogId: jest.fn(() => 'request'), readJournalEntry: jest.fn() }));
jest.mock('@/lib/logs/journalRecovery', () => ({ inspectJournalDraft: jest.fn().mockResolvedValue({ kind: 'ready' }) }));
jest.mock('@/lib/logs/journalDraft', () => ({ journalDraftKey: () => 'draft', readJournalDraft: jest.fn(), writeJournalDraft: jest.fn().mockResolvedValue(undefined), clearJournalDraft: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable }));
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
beforeEach(() => { jest.clearAllMocks(); jest.mocked(readJournalDraft).mockResolvedValue(null); save.mockResolvedValue({ id: 'entry', mutationId: 'request' }); jest.mocked(inspectJournalDraft).mockResolvedValue({ kind: 'ready' }); jest.mocked(writeJournalDraft).mockResolvedValue(undefined); jest.mocked(clearJournalDraft).mockResolvedValue(undefined); jest.mocked(newLogId).mockReturnValue('request'); jest.mocked(readJournalEntry).mockReset(); });
afterEach(() => act(() => renderer?.unmount()));
it('shows only draft recovery until the user chooses, then restores only filled measurements', async () => {
  jest.mocked(readJournalDraft).mockResolvedValue({ version: 1, requestId: 'restored', category: 'watering', date: '2026-10-26', description: '', measurements: { waterMl: '500' } });
  await mount(); expect(button('Log Watering')).toBeUndefined(); expect(button('Save watering')).toBeUndefined();
  const resume = renderer.root.findAll((node: any) => node.props.children?.props?.children === 'Resume activity' && node.props.onPress)[0];
  await act(async () => resume.props.onPress());
  expect(field('Water amount').props.value).toBe('500'); expect(field('pH')).toBeUndefined();
  expect(renderer.root.findByType(PlantDateField).props.value).toBe('2026-10-26');
});
it('returns from the type chooser with the activity and entered details intact', async () => {
  await mount(); await act(async () => field('Water amount').props.onChangeText('500'));
  await act(async () => button('Change activity type').props.onPress());
  expect(button('Save watering')).toBeUndefined();
  expect(writeJournalDraft).toHaveBeenLastCalledWith('draft', expect.objectContaining({ category: 'watering', measurements: expect.objectContaining({ waterMl: '500' }) }));
  await act(async () => button('Back to activity details').props.onPress());
  expect(field('Water amount').props.value).toBe('500');
  expect(button('Save watering')).toBeDefined();
});
it('shows field validation without attempting a save', async () => {
  await mount(); await act(async () => field('Water amount').props.onChangeText('-1'));
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
  await mount(); await act(async () => field('Water amount').props.onChangeText('250'));
  await act(async () => button('Save watering').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('Activity wasn’t saved'); expect(field('Water amount').props.value).toBe('250');
  await act(async () => button('Save watering').props.onPress());
  expect(save).toHaveBeenNthCalledWith(2, 'watering', '', '2026-10-27', expect.objectContaining({ waterMl: 250 }), 'request', expect.anything());
});
it('disables unchanged edits and preserves a changed date as a draft', async () => {
  await mount({ entry: { id: 'entry', description: '', type: 'watering' } });
  expect(button('Save activity changes').props.disabled).toBe(true);
  await act(async () => renderer.root.findByType(PlantDateField).props.onChange('2026-10-26'));
  expect(button('Save activity changes').props.disabled).toBe(false);
  expect(writeJournalDraft).toHaveBeenLastCalledWith('draft', expect.objectContaining({ date: '2026-10-26' }));
});

const byText = (label: string) => renderer.root.findAll((node: any) => node.props.children?.props?.children === label && typeof node.props.onPress === 'function')[0];
const currentEntry = { id: 'entry', type: 'note', category: 'notes', description: 'First', calendarDay: '2026-10-27', updatedBy: 'owner', mutationId: 'original', timestamp: { toDate: () => new Date('2026-10-27T12:00:00Z') } } as any;
it('does not clear or overwrite a draft when recovery fails', async () => {
  jest.mocked(readJournalDraft).mockRejectedValue(new Error('Storage read failed'));
  await mount();
  expect(clearJournalDraft).not.toHaveBeenCalled(); expect(writeJournalDraft).not.toHaveBeenCalled();
  expect(button('Retry draft recovery')).toBeDefined(); expect(button('Save watering')).toBeUndefined();
});
it('retries failed recovery before enabling editing', async () => {
  jest.mocked(readJournalDraft).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(null);
  await mount(); await act(async () => button('Retry draft recovery').props.onPress());
  expect(button('Save watering')).toBeDefined();
});
it('requires explicit review before applying a stale edit draft', async () => {
  jest.mocked(readJournalDraft).mockResolvedValue({ version: 1, requestId: 'old', entryId: 'entry', entryBaseline: 'stale', category: 'notes', date: '2026-10-27', description: 'Old draft', measurements: {} });
  jest.mocked(inspectJournalDraft).mockResolvedValue({ kind: 'conflict', entry: currentEntry });
  await mount({ entry: currentEntry, initialCategory: 'notes' });
  expect(byText('Resume activity')).toBeUndefined();
  await act(async () => byText('Review changes').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('Current saved activity');
  await act(async () => byText('Use draft on current version').props.onPress());
  await act(async () => button('Save activity changes').props.onPress());
  expect(save).toHaveBeenCalledWith('notes', 'Old draft', '2026-10-27', {}, 'request', { entry: currentEntry, baseline: journalRevision(currentEntry) });
});
it('acknowledges the original payload before saving revised values with a new mutation id', async () => {
  jest.mocked(newLogId).mockReturnValueOnce('original').mockReturnValue('corrected');
  save.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ id: 'entry', mutationId: 'original' }).mockResolvedValueOnce({ id: 'entry', mutationId: 'corrected' });
  jest.mocked(readJournalEntry).mockResolvedValue(currentEntry);
  await mount({ initialCategory: 'notes' });
  await act(async () => field('Observation').props.onChangeText('First'));
  await act(async () => button('Save observation').props.onPress());
  await act(async () => field('Observation').props.onChangeText('Revised'));
  await act(async () => button('Save observation').props.onPress());
  expect(save.mock.calls[1][1]).toBe('First'); expect(save.mock.calls[1][4]).toBe('original');
  expect(save.mock.calls[2][1]).toBe('Revised'); expect(save.mock.calls[2][4]).toBe('corrected');
  expect(save.mock.calls[2][5]).toEqual({ entry: currentEntry, baseline: journalRevision(currentEntry) });
  expect(saved).toHaveBeenCalledTimes(1);
});
it('reports a successful commit separately from failed local draft cleanup', async () => {
  await mount(); jest.mocked(clearJournalDraft).mockRejectedValue(new Error('Storage unavailable'));
  await act(async () => button('Save watering').props.onPress());
  expect(saved).toHaveBeenCalledWith({ id: 'entry', mutationId: 'request' }, 'watering', '2026-10-27', false, true);
});
it('does not offer a committed draft as unfinished when cleanup is unavailable', async () => {
  jest.mocked(readJournalDraft).mockResolvedValue({ version: 1, requestId: 'original', category: 'notes', date: '2026-10-27', description: 'First', measurements: {} });
  jest.mocked(inspectJournalDraft).mockResolvedValue({ kind: 'saved', entry: currentEntry });
  jest.mocked(clearJournalDraft).mockRejectedValue(new Error('Storage unavailable'));
  await mount(); expect(byText('Resume activity')).toBeUndefined(); expect(byText('View saved activity')).toBeDefined();
});
it('opens soil checking directly on moisture input without recording watering', async () => {
  await mount({ initialCategory: 'health', initialContext: 'soil-check' });
  expect(field('Soil moisture')).toBeDefined(); expect(field('Water amount')).toBeUndefined(); expect(field('pH')).toBeUndefined();
});
it('offers known watering history before another watering form is filled', async () => {
  const watering = { ...currentEntry, type: 'watering', category: 'watering' };
  await mount({ knownWaterings: { '2026-10-27': watering }, onOpenEntry: jest.fn() });
  expect(button('Save watering')).toBeUndefined(); expect(field('Water amount')).toBeUndefined(); expect(button('Edit existing watering')).toBeDefined();
});
