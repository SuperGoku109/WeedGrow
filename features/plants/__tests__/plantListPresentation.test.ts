import { matchesPlantStatus, plantCardMeta } from '../plantListPresentation';
import type { Plant } from '@/firestoreModels';
it('keeps active and historical plants distinct while retaining the detailed filters', () => {
  for (const status of ['active', 'archived', 'harvested', 'dead'] as const) {
    expect(matchesPlantStatus({ status }, 'past')).toBe(status !== 'active');
    expect(matchesPlantStatus({ status }, 'harvested')).toBe(status === 'harvested');
    expect(matchesPlantStatus({ status }, null)).toBe(true);
  }
});
it('uses individual facts within a garden without inventing an unknown age', () => {
  const plant = { environment: 'outdoor', strain: 'Blue Dream', ageKnown: false, ageDays: 0, plantedIn: 'pot' } as Plant;
  expect(plantCardMeta(plant, false)).toBe('Blue Dream');
  expect(plantCardMeta(plant, true)).toBe('Outdoor · Blue Dream');
  expect(plantCardMeta({ ...plant, ageKnown: true }, false)).toContain('0 days');
});
