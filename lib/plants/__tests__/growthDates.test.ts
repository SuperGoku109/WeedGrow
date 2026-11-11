import type { Plant } from '@/firestoreModels';
import { assertGrowthDates } from '../growthDates';
const plant: Partial<Plant> = { growthStage: 'flowering', emergedOn: '2026-01-10', floweringStartedOn: '2026-02-01', stageStartedOn: '2026-02-01', stageStartedOnEstimated: false };
const today = '2026-04-01';
it('accepts a consistent sequence and dates on the same day', () => {
  expect(() => assertGrowthDates(plant, { growthStage: 'harvested', stageStartedOn: today, harvestedOn: today }, today)).not.toThrow();
  expect(() => assertGrowthDates(plant, { floweringStartedOn: '2026-01-10', stageStartedOn: '2026-01-10' }, today)).not.toThrow();
});
it('rejects harvest before flowering and drying before harvest', () => {
  expect(() => assertGrowthDates(plant, { growthStage: 'harvested', stageStartedOn: '2026-01-20', harvestedOn: '2026-01-20' }, today)).toThrow('Harvest cannot be before flowering');
  expect(() => assertGrowthDates({ growthStage: 'harvested', harvest: { date: '2026-03-01', notes: '', recordId: 'harvest' } }, { growthStage: 'drying', stageStartedOn: '2026-02-28' }, today)).toThrow('preceding recorded');
});
it('rejects curing before a confirmed drying start and future stage dates', () => {
  expect(() => assertGrowthDates({ growthStage: 'drying', harvestedOn: '2026-02-01', stageStartedOn: '2026-02-10' }, { growthStage: 'curing', stageStartedOn: '2026-02-05' }, today)).toThrow('next stage');
  expect(() => assertGrowthDates(plant, { stageStartedOn: '2026-04-02' }, today)).toThrow('today or earlier');
});
it('keeps dates editable, including a mistaken stage and its old flowering date', () => {
  expect(() => assertGrowthDates(plant, { floweringStartedOn: '2026-01-15', stageStartedOn: '2026-01-15' }, today)).not.toThrow();
  expect(() => assertGrowthDates(plant, { growthStage: 'vegetative', stageStartedOn: '2026-02-15' }, today)).not.toThrow();
});
it('does not let an estimated start block an actual date, but validates a known start', () => {
  const baseline = { ...plant, startedOn: '2026-01-20', ageEstimated: true, ageEstimateSource: 'stage' as const };
  expect(() => assertGrowthDates(baseline, { stageStartedOn: '2026-01-10', floweringStartedOn: '2026-01-10' }, today)).not.toThrow();
  expect(() => assertGrowthDates({ ...baseline, ageEstimated: false, ageEstimateSource: null }, {}, today)).toThrow('plant’s start date');
});
