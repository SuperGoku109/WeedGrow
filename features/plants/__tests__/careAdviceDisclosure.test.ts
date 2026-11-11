import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { Modal, Text } from 'react-native';
import DailyCareAdvice from '../components/DailyCareAdvice';
import { plantThemes } from '../components/plantDetailTheme';
import { careAction, careFacts } from '../careSuggestionPresentation';
import type { SuggestionCard } from '@/lib/suggestions/suggestionCards';
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable }));
const card = (id: string, severity: SuggestionCard['severity'], kind: SuggestionCard['kind']): SuggestionCard => ({ id, severity, kind, title: id, summary: id + ' explanation', reasons: [], active: true, metrics: {}, confidence: 'high', algorithmVersion: '1' });
let renderer: any;
const refresh = jest.fn(), record = jest.fn();
function text() { return renderer.root.findAllByType(Text).map((node: any) => node.props.children).flat().filter((value: unknown) => typeof value === 'string').join(' '); }
function button(prefix: string) { return renderer.root.findAll((node: any) => typeof node.props.onPress === 'function' && node.props.accessibilityLabel?.startsWith(prefix))[0]; }
async function mount(cards: SuggestionCard[], extra = {}) { await act(async () => { renderer = create(React.createElement(DailyCareAdvice, { cards, loading: false, error: '', hasLocation: true, theme: plantThemes.grove, onRefresh: refresh, onRecord: record, ...extra })); }); }
afterEach(() => { act(() => renderer?.unmount()); refresh.mockClear(); record.mockClear(); });

test('offers the matching soil-check action and expands real evidence inline', async () => {
  const soil = { ...card('Check soil moisture', 'watch', 'watering'), metrics: { observationDriven: true, action: 'CHECK_SOIL', lastWateringUtc: 1794311640, lastWateringTimeKnown: true, timeZone: 'UTC' }, evidence: { drying: 'FAST', rainfallMm: 0, rainExposure: 'no' } };
  await mount([soil]);
  expect(text()).toContain('Care today'); expect(text()).not.toContain('faster drying');
  expect(button('Water:')).toBeUndefined();
  act(() => button('Check soil:').props.onPress());
  expect(record).toHaveBeenCalledWith('health', 'soil-check');
  act(() => button('Learn why:').props.onPress());
  expect(text()).toContain('faster drying'); expect(text()).toContain('Last watering recorded');
  expect(text()).toContain('0 mm'); expect(text()).toContain('sheltered from rain');
  expect(renderer.root.findAllByType(Modal)).toHaveLength(0);
  act(() => button('Hide why:').props.onPress()); expect(text()).not.toContain('faster drying');
});

test('water and other care actions open the appropriate journal flow without marking care complete', async () => {
  const water = { ...card('Watering may be appropriate', 'watch', 'watering'), metrics: { action: 'CONFIRM_DRY_SOIL', observationDriven: true } };
  const weather = card('Wind warning', 'warn', 'weather');
  const pest = { ...card('Pest follow-up', 'watch', 'health'), metrics: { category: 'pests' } };
  await mount([water, weather, pest]);
  act(() => button('Water:').props.onPress()); expect(record).toHaveBeenLastCalledWith('watering', undefined);
  act(() => button('Log check:').props.onPress()); expect(record).toHaveBeenLastCalledWith('health', undefined);
  act(() => button('Log inspection:').props.onPress()); expect(record).toHaveBeenLastCalledWith('pests', undefined);
  expect(text()).toContain('Watering may be appropriate');
  expect(careAction({ ...water, metrics: { needsWater: null } })).toBeNull();
});

test('read-only plants keep explanations without offering recording actions', async () => {
  await mount([{ ...card('Soil check', 'watch', 'watering'), metrics: { observationDriven: true } }], { canRecord: false });
  expect(button('Check soil:')).toBeUndefined(); expect(button('Learn why:')).toBeDefined();
});

test('keeps each explanation independent and prioritizes important warnings', async () => {
  const soil = { ...card('Soil check', 'info', 'watering'), reasons: ['A soil report is missing.'] };
  const wind = { ...card('Wind warning', 'critical', 'weather'), evidence: { variable: 'wind_gust_ms', value: 20, phase: 'forecast', provider: 'Example weather service' } };
  await mount([soil, wind]);
  expect(text().indexOf('Wind warning')).toBeLessThan(text().indexOf('Soil check'));
  act(() => button('Learn why: Wind').props.onPress()); expect(text()).toContain('72 km/h'); expect(text()).not.toContain('A soil report is missing.');
  act(() => button('Learn why: Soil').props.onPress()); expect(text()).toContain('A soil report is missing.'); expect(text()).toContain('72 km/h');
});

test('does not invent weather, soil readings, or complete history when evidence is absent', () => {
  expect(careFacts(card('Unavailable', 'info', 'watering'))).toEqual([]);
  const facts = careFacts({ ...card('Check', 'watch', 'watering'), metrics: { observationDriven: true }, evidence: { drying: 'UNKNOWN', rainfallMm: null, value: NaN } });
  expect(facts.map(f => f.value).join(' ')).toContain('incomplete or stale');
  expect(facts.map(f => f.value).join(' ')).not.toContain('0 mm');
});

test('preserves loading and failure feedback', async () => {
  await mount([], { loading: true }); expect(text()).toContain('Checking today'); expect(button('Learn why:')).toBeUndefined();
  await act(async () => renderer.update(React.createElement(DailyCareAdvice, { cards: [], loading: false, error: 'Connection unavailable', hasLocation: true, theme: plantThemes.grove, onRefresh: refresh })));
  expect(text()).toContain('Connection unavailable'); act(() => button('Retry care advice').props.onPress()); expect(refresh).toHaveBeenCalledTimes(1);
});
