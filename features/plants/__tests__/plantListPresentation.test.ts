import { matchesPlantStatus, plantCardMeta, plantCardStage } from '../plantListPresentation';
import type { Plant } from '@/firestoreModels';
it('keeps active and historical plants distinct while retaining the detailed filters', () => {
  for (const status of ['active', 'archived', 'harvested', 'dead'] as const) {
    expect(matchesPlantStatus({ status }, 'past')).toBe(status !== 'active');
    expect(matchesPlantStatus({ status }, 'harvested')).toBe(status === 'harvested');
    expect(matchesPlantStatus({ status }, null)).toBe(true);
  }
});
it('labels a stage-based age estimate when an individual plant has no user age', () => {
  const plant = { status: 'active', environment: 'outdoor', growthStage: 'seedling', strain: 'Blue Dream', ageKnown: false, ageDays: 0, plantedIn: 'pot' } as Plant;
  expect(plantCardMeta(plant, false)).toBe('Blue Dream');
  expect(plantCardMeta(plant, true)).toBe('Outdoor · Blue Dream');
  expect(plantCardStage(plant)).toBe('Seedling · ~25 days');
  expect(plantCardStage(plant, false)).toBe('Seedling · Plant age: About 25 days (stage estimate)');
  expect(plantCardStage({ ...plant, ageKnown: true })).toContain('0 days');
});
