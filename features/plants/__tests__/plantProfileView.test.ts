import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import PlantDetails from '../components/PlantDetails';
import { plantThemes } from '../components/plantDetailTheme';
import type { Plant } from '@/firestoreModels';
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: () => null }));
jest.mock('@/ui/GrowMotion', () => ({ GrowPress: jest.requireActual('react-native').Pressable }));
const edit = jest.fn();
const plant = { name: 'Test', strain: '', growthStage: 'seedling', status: 'active', environment: 'outdoor', plantedIn: 'pot', ageKnown: false, owners: [], createdAt: null, updatedAt: null, location: { lat: 0, lng: 0 }, notes: 'A full saved note. '.repeat(30) } satisfies Plant;
let renderer: any;
function button(label: string) { return renderer.root.findAll((node: any) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0]; }
beforeEach(() => act(() => { renderer = create(React.createElement(PlantDetails, { plant, theme: plantThemes.grove, onEdit: jest.fn(), onEditSection: edit })); }));
afterEach(() => act(() => renderer.unmount()));
it('routes every visible edit action to its existing section editor', () => {
  for (const [label, section] of [['Basics', 'Basics'], ['Growing setup', 'Growing setup'], ['Care routine', 'Care plan'], ['Location', 'Location and weather'], ['Notes', 'Notes and history']]) {
    act(() => button('Edit ' + label).props.onPress()); expect(edit).toHaveBeenLastCalledWith(section);
  }
});
it('reveals technical details and full notes on demand without hiding ordinary saved facts', () => {
  expect(JSON.stringify(renderer.toJSON())).toContain('Seedling');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('0.0000, 0.0000');
  act(() => button('Coordinates and sensor details').props.onPress());
  expect(JSON.stringify(renderer.toJSON())).toContain('0.0000, 0.0000');
  act(() => button('Read full plant notes').props.onPress());
  const note = renderer.root.findAll((node: any) => node.props.children === plant.notes && node.props.selectable)[0];
  expect(note.props.numberOfLines).toBeUndefined();
});
