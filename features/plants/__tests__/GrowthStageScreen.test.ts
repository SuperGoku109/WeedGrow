import React from 'react';
// @ts-expect-error Expo ships the renderer without declarations.
import { act, create } from 'react-test-renderer';
import Screen from '../screens/GrowthStageScreen';
import Summary from '../components/GrowthStageSummary';
import Controls from '../components/GrowthStageCard';
import Sheet from '../components/PlantEditorSheet';
import { plantThemes } from '../components/plantDetailTheme';
import type { Plant } from '@/firestoreModels';

const mockPlant = { name: 'Plant', growthStage: 'vegetative', status: 'active', stageStartedOn: '2026-10-01', stageStartedOnEstimated: true, locationTimeZone: 'Africa/Johannesburg' } as Plant;
const mockRouter = { push: jest.fn(), back: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'p', theme: 'grove' }), useRouter: () => mockRouter, useFocusEffect: () => {} }));
jest.mock('../hooks/usePlant', () => ({ usePlant: () => ({ plant: mockPlant, loading: false }) }));
jest.mock('@/hooks/useMinuteClock', () => ({ useMinuteClock: () => new Date('2026-11-11T12:00:00Z') }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual('react-native').View }));
jest.mock('react-native-paper', () => ({ Snackbar: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable }));
jest.mock('../components/GrowthStageCard', () => () => null);
jest.mock('../components/PlantEditorSheet', () => ({ children }: { children: React.ReactNode }) => children);
let renderer: any;
function control(label: string) { return renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]; }
async function mount() { await act(async () => { renderer = create(React.createElement(Screen)); }); }
afterEach(() => { act(() => renderer?.unmount()); jest.clearAllMocks(); });

it('browses stage tabs without changing the plant and returns to the current stage', async () => {
  await mount();
  act(() => control('Flowering').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('Plant remains in vegetative.');
  expect(renderer.root.findAllByType(Controls)).toHaveLength(0);
  expect(mockPlant.growthStage).toBe('vegetative');
  act(() => control('Back to current stage').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('YOUR CURRENT STAGE');
  expect(JSON.stringify(renderer.toJSON())).toContain('These sections are placeholders.');
  expect(mockRouter.push).not.toHaveBeenCalled();
});

it('keeps management in a dismissible sheet and routes harvest to existing lifecycle management', async () => {
  await mount();
  act(() => control('Set up stage checks').props.onPress());
  expect(renderer.root.findByType(Controls).props.controlsOnly).toBe(true);
  act(() => renderer.root.findByType(Controls).props.onBusyChange(true));
  expect(renderer.root.findByType(Sheet).props.busy).toBe(true);
  act(() => renderer.root.findByType(Controls).props.onBusyChange(false));
  act(() => renderer.root.findByType(Controls).props.onHarvest());
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/plant/[id]', params: { id: 'p', section: 'Details', managePlant: '1' } });
});

it('offers one summary action without management buttons or raw start-date prose', async () => {
  const onPress = jest.fn();
  await act(async () => { renderer = create(React.createElement(Summary, { plant: mockPlant, theme: plantThemes.grove, onPress, now: new Date('2026-11-11T12:00:00Z') })); });
  const buttons = renderer.root.findAll((node: any) => node.props.accessibilityRole === 'button' && typeof node.type !== 'string');
  // The summary uses a single Pressable; native descendants may repeat accessibility props.
  const summary = buttons[0];
  act(() => summary.props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('60–150+');
  expect(tree).not.toContain('Stage options');
  expect(tree).not.toContain('Stage window:');
  expect(tree).not.toContain('Estimated start');
});
