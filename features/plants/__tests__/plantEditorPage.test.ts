import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Modal, Text, TextInput, View } from 'react-native';
import Editor from '../components/PlantSectionEditor';
import CareScheduleEditor from '../components/CareScheduleEditor';
import { EditorSelect } from '../components/PlantEditorFields';
import { updatePlant } from '../api/plantService';
import type { Plant } from '@/firestoreModels';

const mockClear = jest.fn().mockResolvedValue(undefined), mockClose = jest.fn(), mockSaved = jest.fn(), mockGuard = jest.fn();
jest.mock('../api/plantService', () => ({ updatePlant: jest.fn().mockResolvedValue(undefined), deletePlantAndSubcollections: jest.fn() }));
jest.mock('@/ui/useEditDraft', () => ({ useEditDraft: () => ({ ready: true, saved: null, baseline: { current: {} }, clear: mockClear }), DraftRecovery: () => null }));
jest.mock('@/ui/useDiscardGuard', () => ({ useDiscardGuard: (dirty: boolean) => { mockGuard(dirty); return { requestClose: (fn: () => void) => fn(), finish: (fn: () => void) => fn(), setRemovalAllowed: jest.fn(), dialog: null }; } }));
jest.mock('@/features/addPlant/api/environmentApi', () => ({ fetchSensorProfiles: jest.fn().mockResolvedValue([]) }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable, useReducedMotion: () => true }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('../components/PlantEditorFields', () => {
  const React = jest.requireActual('react'), { TextInput, View } = jest.requireActual('react-native');
  return { EditorTheme: React.createContext({}), EditorField: ({ label, ...props }: any) => React.createElement(TextInput, { ...props, accessibilityLabel: label }), EditorSelect: ({ label, ...props }: any) => React.createElement(View, { ...props, accessibilityLabel: label }) };
});
jest.mock('../components/EditorPotSize', () => () => null);
jest.mock('../components/PlantDateField', () => ({ __esModule: true, default: () => null, displayDay: (day: string) => day }));
jest.mock('@/features/location/PlantLocationEditor', () => () => null);
jest.mock('@/ui/ActionDialog', () => () => null);

let renderer: any;
const plant = { name: 'Garden plant', status: 'active', environment: 'outdoor', plantedIn: 'pot', potSize: '10 L', growthStage: 'seedling', locationMode: 'custom' } as Plant;
const button = (label: string) => renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const input = (label: string) => renderer.root.findAllByType(TextInput).find((node: any) => node.props.accessibilityLabel === label);
async function mount() { await act(async () => { renderer = create(React.createElement(Editor, { plantId: 'p', plant, section: 'All', presentation: 'page', portrait: React.createElement(View, { testID: 'plant-portrait' }), onClose: mockClose, onSaved: mockSaved })); }); }
beforeEach(() => jest.clearAllMocks());
afterEach(() => act(() => renderer?.unmount()));

test('uses a dedicated page with a portrait, categorized panels and no modal', async () => {
  await mount();
  const text = renderer.root.findAllByType(Text).map((node: any) => node.props.children).flat().join(' ');
  for (const title of ['Edit plant', 'Plant details', 'Age and timeline', 'Container and soil', 'Location and site', 'Care and reminders', 'Notes and history']) expect(text).toContain(title);
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  expect(renderer.root.findAllByProps({ testID: 'plant-portrait' }).length).toBeGreaterThan(0);
  expect(input('Plant name')).toBeDefined(); expect(input('Height')).toBeDefined(); expect(input('Lasting notes')).toBeDefined();
  act(() => button('Back from edit plant').props.onPress()); expect(mockClose).toHaveBeenCalledTimes(1);
  expect(updatePlant).not.toHaveBeenCalled();
});

test('saves edits from separate panels through the existing combined update flow', async () => {
  await mount();
  act(() => input('Plant name').props.onChangeText('Renamed'));
  act(() => input('Height').props.onChangeText('65'));
  act(() => input('Pests recorded').props.onChangeText('Aphids'));
  const material = renderer.root.findAllByType(EditorSelect).find((node: any) => node.props.label === 'Pot material');
  act(() => material.props.onSelect('fabric'));
  const site = renderer.root.findAllByType(EditorSelect).find((node: any) => node.props.label === 'Site');
  act(() => site.props.onSelect('balcony'));
  const feeding = renderer.root.findAllByType(CareScheduleEditor).find((node: any) => node.props.kind === 'feeding');
  act(() => feeding.props.onChange({ type: 'interval', intervalDays: 14, timeOfDay: '10:00' }));
  expect(mockGuard).toHaveBeenLastCalledWith(true);
  expect(updatePlant).not.toHaveBeenCalled();
  await act(async () => { await button('Save section changes').props.onPress(); });
  expect(updatePlant).toHaveBeenCalledWith('p', expect.objectContaining({ name: 'Renamed', height: 65, pests: ['Aphids'], potMaterial: 'fabric', growingSite: 'balcony', feedingReminderSchedule: { type: 'interval', intervalDays: 14, timeOfDay: '10:00' } }), {});
  expect(mockSaved).toHaveBeenCalledTimes(1); expect(mockClear).toHaveBeenCalledTimes(1);
});
