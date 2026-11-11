import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { JournalTimeline } from '../components/PlantJournal';
import { plantThemes } from '../components/plantDetailTheme';
import type { PlantLog } from '@/firestoreModels';
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/ui/PlantImage', () => ({ PlantImage: () => null }));
const stamp = { toDate: () => new Date('2026-10-27T12:00:00Z'), toMillis: () => Date.parse('2026-10-27T12:00:00Z') };
let renderer: any;
const onEdit = jest.fn(); const onDelete = jest.fn(); const onViewPhoto = jest.fn(); const onRetry = jest.fn();
function mount(logs: (PlantLog & { id: string })[], extra = {}) { act(() => { renderer = create(React.createElement(JournalTimeline, { logs, theme: plantThemes.grove, loading: false, error: '', onEdit, onDelete, onViewPhoto, onRetry, ...extra })); }); }
const entry = (type: PlantLog['type'], extra = {}) => ({ id: type, type, timestamp: stamp, updatedBy: 'owner', ...extra }) as unknown as PlantLog & { id: string };
const button = (label: string) => renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && node.props.onPress)[0];
afterEach(() => act(() => renderer?.unmount()));
it('routes photos to photo management and does not expose destructive menus for generated records', () => {
  mount([entry('photo', { photoUri: 'https://example.test/photo.jpg' }), entry('harvest'), entry('stage_change'), entry('note', { movement: {} })]);
  expect(renderer.root.findAll((node: any) => node.props.accessibilityLabel?.startsWith('Manage '))).toHaveLength(0);
  act(() => button('View in Photos').props.onPress()); expect(onViewPhoto).toHaveBeenCalledTimes(1);
});
it('keeps zero-valued measurements visible and distinguishes saved feedback', () => {
  mount([entry('watering', { waterMl: 0, ph: 0 })], { highlightedId: 'watering', highlightLabel: 'Activity saved' });
  const tree = JSON.stringify(renderer.toJSON()); expect(tree).toContain('Activity saved'); expect(tree).toContain('Water amount'); expect(tree).toContain('pH'); expect(tree).toContain('0');
});
it('shows retry feedback without hiding existing records', () => {
  mount([entry('note', { description: 'Saved observation' })], { error: 'Offline' });
  expect(JSON.stringify(renderer.toJSON())).toContain('Saved observation'); act(() => button('Retry activities').props.onPress()); expect(onRetry).toHaveBeenCalledTimes(1);
});
it('lets long observations expand without opening editing', () => {
  const description = 'A long observation. '.repeat(30); mount([entry('note', { description })]);
  act(() => button('Read full observation').props.onPress());
  const text = renderer.root.findAll((node: any) => node.props.selectable && node.props.children === description)[0];
  expect(text.props.numberOfLines).toBeUndefined(); expect(onEdit).not.toHaveBeenCalled();
});

it('groups reported observations and hides only redundant generated descriptions', () => {
  mount([entry('note', { category: 'health', moistureState: 'WET', description: 'Health measurements recorded.' })]);
  let tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Soil condition'); expect(tree).toContain('Wet'); expect(tree).not.toContain('User report');
  expect(tree).toContain('Soil reported wet'); expect(tree).not.toContain('Health measurements recorded.');
  act(() => renderer.unmount());
  mount([entry('note', { category: 'health', moistureState: 'WET', description: 'Checked after the rain.' })]);
  tree = JSON.stringify(renderer.toJSON()); expect(tree).toContain('Checked after the rain.');
});
it('keeps missing time explicit instead of showing a fabricated clock value', () => {
  mount([entry('note', { description: 'Observed today', occurrencePrecision: 'date' })]);
  const tree = JSON.stringify(renderer.toJSON()); expect(tree).toContain('Time not recorded'); expect(tree).toContain('No time');
});

it('opens edit and delete in a popup when a row is tapped, then closes before editing', () => {
  const log = entry('watering', { waterMl: 250 });
  mount([log]);
  const row = renderer.root.findAll((node: any) => node.props.accessibilityLabel?.startsWith('Manage Watering entry') && node.props.onPress)[0];
  act(() => row.props.onPress());
  expect(button('Delete Watering entry')).toBeDefined();
  act(() => button('Edit Watering entry').props.onPress());
  expect(onEdit).toHaveBeenCalledWith(log);
  expect(button('Delete Watering entry')).toBeUndefined();
});
