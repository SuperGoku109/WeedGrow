import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import WeatherPanel from '../components/WeatherPanel';
import { plantThemes } from '../components/plantDetailTheme';
import type { WeatherCacheEntry } from '@/firestoreModels';
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ ...jest.requireActual('@/ui/GrowMotion'), GrowPress: jest.requireActual('react-native').Pressable }));
let renderer: any;
const weather = { temperature: 0, humidity: 80, rainfall: 0, rainIntervalSeconds: 900, temperatureBasis: 'model', source: 'Open-Meteo', observationUtc: 1794447000, timeZone: 'Africa/Johannesburg', windSpeed: 2 } as WeatherCacheEntry;
const button = (label: string) => renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
function mount(extra = {}) { act(() => { renderer = create(React.createElement(WeatherPanel, { theme: plantThemes.grove, label: 'Garden', weather, status: 'Weather updated 2 min ago', ...extra })); }); }
afterEach(() => act(() => renderer?.unmount()));
it('keeps zero readings, rain interval, model provenance and freshness visible', () => {
  mount(); const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('0°C'); expect(tree).toContain('0 mm'); expect(tree).toContain('Rain · 15 min');
  expect(tree).toContain('Modelled conditions'); expect(tree).toContain('Weather updated 2 min ago');
  expect(tree).not.toContain('Observed conditions'); expect(tree).not.toContain('Wind');
});
it('expands details in place and keeps absent readings distinct from zero', () => {
  mount(); act(() => button('View weather details').props.onPress());
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Wind'); expect(tree).toContain('2 m/s'); expect(tree).toContain('—');
  expect(tree).not.toContain('Model valid at'); expect(tree).not.toContain('CC BY 4.0'); expect(tree).toContain('Source: Open-Meteo');
  act(() => button('Hide weather details').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Wind');
});
it('keeps warning and refresh feedback available without replacing existing readings', () => {
  const onRefresh = jest.fn(); mount({ weather: { ...weather, forecastIssue: 'repeated_point_forecast', qualityNotes: ['Daily data unavailable.'] }, error: 'Could not refresh.', onRefresh });
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Daily forecast unavailable.'); expect(tree).toContain('Daily data unavailable.'); expect(tree).toContain('Could not refresh.'); expect(tree).toContain('0°C');
  act(() => button('Refresh plant weather').props.onPress()); expect(onRefresh).toHaveBeenCalledTimes(1);
});

it('shows an unavailable state without inventing weather readings', () => {
  const onRefresh = jest.fn(); mount({ weather: undefined, error: 'Add a location.', onRefresh });
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('Weather unavailable'); expect(tree).toContain('Add a location.');
  expect(tree).not.toContain('0°C'); expect(button('View weather details')).toBeUndefined();
  act(() => button('Refresh plant weather').props.onPress()); expect(onRefresh).toHaveBeenCalledTimes(1);
});
