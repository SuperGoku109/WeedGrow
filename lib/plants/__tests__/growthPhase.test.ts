import { addDays } from '@/lib/dates/plantDay';
import type { Plant } from '@/firestoreModels';
import { GROWTH_PHASES, growthPhaseProgress, growthPhase, phaseDayWindowLabel } from '../growthPhase';
const base = { startedOn: '2026-01-01', ageKnown: true, growthStage: 'vegetative', status: 'active', locationTimeZone: 'UTC' } as Plant;
const onDay = (day: number) => new Date(`${addDays('2026-01-01', day)}T12:00:00Z`);
it('uses the user planting windows rather than adding stage durations', () => {
  expect(GROWTH_PHASES.map(item => [item.startWeek, item.endWeek])).toEqual([[1, 1], [2, 3], [4, 9], [10, 14], [15, 18], [19, 20], [21, 22], [23, 32]]);
  expect(GROWTH_PHASES.map(item => phaseDayWindowLabel(item.key))).toEqual(['Days 1–7', 'Days 8–21', 'Days 22–63', 'Days 64–98', 'Days 99–126', 'Days 127–140', 'Days 141–154', 'Days 155–224']);
  expect(growthPhaseProgress(base, onDay(42))).toMatchObject({ fraction: .5, week: 7, phaseDay: 22, phaseDays: 42, attention: false, next: 'flowering' });
});
it('suggests a quiet review in the final 15 percent and never changes the confirmed stage', () => {
  expect(growthPhaseProgress(base, onDay(57))).toMatchObject({ attention: true, phase: 'vegetative' });
  expect(base.growthStage).toBe('vegetative');
  expect(growthPhaseProgress(base, onDay(100)).fraction).toBe(1);
  expect(growthPhaseProgress(base, onDay(100)).phaseDay).toBe(80);
  expect(growthPhaseProgress(base, onDay(5)).fraction).toBe(0);
});
it('tracks late flowering as a phase within flowering and preserves terminal stages', () => {
  expect(growthPhase({ ...base, growthStage: 'flowering', floweringPhase: 'late' })).toBe('late_flowering');
  expect(growthPhase({ ...base, growthStage: 'harvested', floweringPhase: 'late' })).toBe('harvested');
  expect(growthPhaseProgress({ ...base, status: 'dead' }, onDay(100)).attention).toBe(false);
});
