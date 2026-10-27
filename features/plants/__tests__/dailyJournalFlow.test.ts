import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import PlantDetailScreen from '../screens/PlantDetailScreen';
import Composer from '../components/PlantLogComposer';
import { JournalTimeline } from '../components/PlantJournal';
import JournalDateNavigator from '../components/JournalDateNavigator';
import DailyCareAdvice from '../components/DailyCareAdvice';
import PlantWeather from '../components/PlantWeather';
import { saveJournalEntry } from '@/lib/logs/journalRepository';
import type { PlantLog } from '@/firestoreModels';
let mockNow = new Date('2026-10-26T12:00:00Z');
let mockParams: { id: string; section?: string; journalDate?: string } = { id: 'plant' };
const mockRouter = { setParams: jest.fn(patch => Object.assign(mockParams, patch)), push: jest.fn() };
let mockLogs: (PlantLog & { id: string })[] = [];
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams, useRouter: () => mockRouter, useFocusEffect: () => {} }));
jest.mock('@/services/session', () => ({ useSession: () => ({ user: { uid: 'owner' } }) }));
jest.mock('@/hooks/useMinuteClock', () => ({ useMinuteClock: () => mockNow }));
jest.mock('@/features/plants/hooks/usePlant', () => ({ usePlant: () => ({ plant: { name: 'Plant', owners: [], status: 'active', growthStage: 'seedling', environment: 'outdoor', plantedIn: 'pot' }, loading: false }) }));
jest.mock('@/features/plants/hooks/usePlantJournalData', () => ({ usePlantJournalData: () => ({ logs: { '2026-10-26': mockLogs }, weather: {}, loading: false, weatherLoading: false, error: '', weatherError: '', retry: jest.fn() }) }));
jest.mock('@/features/plants/hooks/useProgressGallery', () => ({ useProgressGallery: () => ({ pics: [], loading: false }) }));
jest.mock('@/lib/logs/journalRepository', () => ({ saveJournalEntry: jest.fn().mockResolvedValue({ id: 'entry', mutationId: 'request' }), deleteJournalEntry: jest.fn() }));
jest.mock('@/lib/suggestions/suggestionCards', () => ({ evaluateSuggestionCardsForPlant: jest.fn().mockResolvedValue({ cards: [] }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue('grove') }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-paper', () => ({ Snackbar: () => null }));
jest.mock('react-native-calendars', () => ({ Calendar: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, GrowReveal: jest.requireActual('react-native').View, useReducedMotion: () => true }));
jest.mock('@/ui/PlantImage', () => ({ PlantImage: () => null }));
jest.mock('@/ui/ActionDialog', () => () => null);
jest.mock('@/features/plants/components/PlantBanner', () => () => null);
jest.mock('@/features/plants/components/PlantMovementHistory', () => () => null);
jest.mock('@/features/plants/components/PlantLifecycle', () => () => null);
jest.mock('@/features/plants/components/PlantWeather', () => () => null);
jest.mock('@/features/plants/components/PlantSectionEditor', () => () => null);
jest.mock('@/features/plants/components/JournalSearch', () => () => null);
jest.mock('@/features/plants/components/LoadingView', () => () => null);
jest.mock('@/features/plants/components/NotFoundView', () => () => null);
jest.mock('@/ui/LoadError', () => () => null);
jest.mock('@/features/plants/components/PlantPhotoGallery', () => ({ PhotoComposer: () => null, PlantPhotoGallery: () => null }));
jest.mock('@/features/plants/components/PlantLogComposer', () => ({ __esModule: true, default: () => null, logChoices: [{ key: 'watering', label: 'Water', icon: 'water-outline' }, { key: 'feeding', label: 'Feed', icon: 'flask-outline' }, { key: 'notes', label: 'Note', icon: 'note-outline' }] }));
let renderer: any;
async function mount() { await act(async () => { renderer = create(React.createElement(PlantDetailScreen)); }); }
function button(label: string) { return renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]; }
function selectedTab() { return renderer.root.findAll((node: any) => node.props.accessibilityRole === 'tab' && node.props.accessibilityState?.selected && typeof node.props.children?.props?.children === 'string')[0].props.children.props.children; }
beforeEach(() => { jest.useFakeTimers(); mockNow = new Date('2026-10-26T12:00:00Z'); jest.setSystemTime(mockNow); mockParams = { id: 'plant' }; mockLogs = []; jest.mocked(saveJournalEntry).mockClear(); });
afterEach(() => { act(() => renderer?.unmount()); jest.useRealTimers(); });
function dates() { return renderer.root.findByType(JournalDateNavigator); }
function tab(name: string) { return renderer.root.findAll((node: any) => node.props.accessibilityRole === 'tab' && node.props.children?.props?.children === name && typeof node.props.onPress === 'function')[0]; }

it('opens one quiet daily Journal with three tabs and fixed creation actions', async () => {
  await mount(); const tree = JSON.stringify(renderer.toJSON());
  expect(selectedTab()).toBe('Journal'); expect(dates().props.selected).toBe('2026-10-26');
  expect(tab('Today')).toBeUndefined(); expect(tab('Photos')).toBeDefined(); expect(tab('Details')).toBeDefined();
  expect(tree).toContain('Nothing recorded today.'); expect(tree).not.toContain('Not recorded today'); expect(tree).not.toContain('View full journal');
  expect(button('Add activity')).toBeDefined(); expect(button('Add photo')).toBeDefined();
});
it('shows all actual records once and keeps management behind an entry menu', async () => {
  mockLogs = Array.from({ length: 4 }, (_, index) => ({ id: String(index), type: index === 0 ? 'watering' : 'note', description: 'Recorded ' + index, updatedBy: '', timestamp: { toDate: () => mockNow, toMillis: () => mockNow.getTime() } } as PlantLog & { id: string }));
  await mount(); expect(renderer.root.findByType(JournalTimeline).props.logs).toHaveLength(4);
  expect(JSON.stringify(renderer.toJSON())).toContain('Recorded 3'); expect(button('Edit Watering entry')).toBeUndefined();
  const menu = renderer.root.findAll((node: any) => node.props.accessibilityLabel?.startsWith('Manage Watering entry') && typeof node.props.onPress === 'function')[0];
  act(() => menu.props.onPress()); expect(button('Edit Watering entry')).toBeDefined(); expect(button('Delete Watering entry')).toBeDefined();
});
it.each(['2026-10-26', '2026-10-25'])('after saving %s, selects that day in the same Journal', async day => {
  await mount(); act(() => button('Add activity').props.onPress());
  await act(async () => { const props = renderer.root.findByType(Composer).props; const result = await props.onSave('notes', 'Checked the leaves', day, {}, 'request'); props.onSaved(result, 'notes', day, false, false); });
  expect(saveJournalEntry).toHaveBeenCalledTimes(1); expect(selectedTab()).toBe('Journal'); expect(dates().props.selected).toBe(day);
  expect(renderer.root.findAllByType(Composer)).toHaveLength(0);
});
it('keeps a saved day historical after midnight rather than following today away from it', async () => {
  await mount(); act(() => button('Add activity').props.onPress());
  mockNow = new Date('2026-10-27T12:00:00Z'); jest.setSystemTime(mockNow);
  await act(async () => { const props = renderer.root.findByType(Composer).props; const result = await props.onSave('notes', 'Late entry', '2026-10-26', {}, 'midnight'); props.onSaved(result, 'notes', '2026-10-26', false, false); });
  expect(dates().props.selected).toBe('2026-10-26'); expect(renderer.root.findAllByType(DailyCareAdvice)).toHaveLength(0);
});
it('retains the browsed date across tabs and never shows live advice or refreshable current weather for that day', async () => {
  await mount(); act(() => dates().props.onJump('2026-10-25'));
  expect(renderer.root.findAllByType(DailyCareAdvice)).toHaveLength(0); expect(renderer.root.findByType(PlantWeather).props.date).toBe('2026-10-25');
  act(() => tab('Photos').props.onPress()); act(() => tab('Journal').props.onPress()); expect(dates().props.selected).toBe('2026-10-25');
  act(() => button('Add activity').props.onPress()); expect(renderer.root.findByType(Composer).props.initialDate).toBe('2026-10-25');
});
it('keeps a single activity block across repeated date changes', async () => {
  await mount();
  for (const date of ['2026-10-25', '2026-10-24', '2026-10-26']) {
    act(() => dates().props.onJump(date));
    expect(renderer.root.findAllByType(JournalTimeline)).toHaveLength(1);
    expect(renderer.root.findByType(PlantWeather).props.date).toBe(date);
  }
});
it('makes future days forecast-only and allows returning to today without losing creation actions', async () => {
  await mount(); act(() => dates().props.onJump('2026-10-27'));
  expect(button('Add activity').props.disabled).toBe(true); expect(renderer.root.findAllByType(DailyCareAdvice)).toHaveLength(0);
  act(() => button('Add activity').props.onPress()); expect(renderer.root.findAllByType(Composer)).toHaveLength(0);
  expect(renderer.root.findByType(PlantWeather).props.date).toBe('2026-10-27');
  act(() => dates().props.onToday()); expect(button('Add activity').props.disabled).toBe(false); expect(dates().props.selected).toBe('2026-10-26');
});
it('maps old Today links to the daily Journal and preserves a valid history deep link', async () => {
  mockParams = { id: 'plant', section: 'Today', journalDate: '2026-10-25' }; await mount();
  expect(selectedTab()).toBe('Journal'); expect(dates().props.selected).toBe('2026-10-25');
});
