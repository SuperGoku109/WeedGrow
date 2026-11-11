import { durationMidpoint, STAGE_DURATION_RANGES, stageAgeDefault, stageDurationLabel } from '../stageAgeDefaults';
import { assertLivingGrowthChange, livingGrowthEnded } from '../growthLifecycle';

it('uses the user’s seed-grown outdoor ranges and preserves the open-ended upper windows', () => {
  expect(STAGE_DURATION_RANGES).toMatchObject({
    germination: { min: 3, max: 10, openEnded: false }, seedling: { min: 14, max: 21, openEnded: false },
    vegetative: { min: 60, max: 150, openEnded: true }, preflower: { min: 7, max: 14, openEnded: false },
    flowering: { min: 56, max: 84, openEnded: true }, clone: { min: 7, max: 21, openEnded: false },
  });
  expect(stageDurationLabel('vegetative')).toBe('60–150+ days');
  expect(stageDurationLabel('flowering')).toBe('56–84+ days');
  expect(stageDurationLabel('preflower')).toBe('7–14 days');
});
it('derives stage midpoint and cumulative total age separately without adding the overlapping transition twice', () => {
  expect(stageAgeDefault('germination')).toMatchObject({ ageDays: 7, stageDays: 7 });
  expect(stageAgeDefault('seedling')).toMatchObject({ ageDays: 25, stageDays: 18 });
  expect(stageAgeDefault('vegetative')).toMatchObject({ ageDays: 130, stageDays: 105 });
  expect(stageAgeDefault('flowering')).toMatchObject({ ageDays: 200, stageDays: 70 });
  expect(durationMidpoint('preflower')).toBe(11);
  expect(stageAgeDefault('clone')).toMatchObject({ ageDays: 14, stageDays: 14 });
  expect(stageAgeDefault('toString')).toMatchObject({ ageDays: 0, stageDays: 0 });
});
it('keeps the original spec’s optional processing windows', () => {
  expect(stageDurationLabel('drying')).toBe('7–14 days');
  expect(stageDurationLabel('curing')).toBe('14–28+ days');
  expect(stageAgeDefault('drying')).toMatchObject({ ageDays: 211, stageDays: 11 });
  expect(stageAgeDefault('curing')).toMatchObject({ ageDays: 232, stageDays: 21 });
});
it('makes harvest terminal for living growth while allowing date corrections and processing', () => {
  const plant = { growthStage: 'harvested' as const, status: 'harvested' as const, harvestedOn: '2026-11-01' };
  expect(livingGrowthEnded(plant)).toBe(true);
  expect(() => assertLivingGrowthChange(plant, { status: 'active' })).toThrow('Harvest ended');
  expect(() => assertLivingGrowthChange(plant, { growthStage: 'vegetative' })).toThrow('Harvest ended');
  expect(() => assertLivingGrowthChange({ ...plant, status: 'archived' }, { status: 'active' })).toThrow('Harvest ended');
  expect(() => assertLivingGrowthChange(plant, { growthStage: 'drying', stageStartedOn: '2026-11-02' })).not.toThrow();
  expect(() => assertLivingGrowthChange(plant, { harvestedOn: '2026-10-31' })).not.toThrow();
});
