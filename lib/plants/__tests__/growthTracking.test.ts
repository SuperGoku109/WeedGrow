import type { Plant } from '@/firestoreModels';
import { addDays } from '@/lib/dates/plantDay';
import { daylightHours, daysInStage, stageChangeFields, stagePushPlan, stageSuggestion } from '../growthTracking';
import { stageTiming } from '../stageAgeDefaults';
const base = { name: 'Hops', owners: ['owner'], status: 'active', environment: 'outdoor', plantedIn: 'ground', growthStage: 'germination', stageStartedOn: '2026-01-01', locationTimeZone: 'Africa/Johannesburg' } as Plant;
const on = (day: string) => new Date(day + 'T12:00:00Z');
it('uses confirmed stage dates and labels a missing stage date as estimated', () => {
  expect(stageTiming({ ...base, stageStartedOn: undefined, ageDays: 99 }, on('2026-01-20')).estimated).toBe(true);
  expect(daysInStage(base, new Date('2026-01-05T23:30:00Z'))).toBe(5);
  expect(stageSuggestion(base, on('2026-01-04'))).toBeNull();
  expect(stageSuggestion(base, on('2026-01-06'))?.target).toBe('seedling');
  expect(stageSuggestion(base, on('2026-01-15'))?.id).toBe(stageSuggestion(base, on('2026-01-06'))?.id);
  expect(base.growthStage).toBe('germination');
});
it('gives legacy plants a stable, clearly estimated stage clock and clears that estimate on confirmation', () => {
  const legacy = { ...base, growthStage: 'seedling' as const, stageStartedOn: undefined, createdAt: { toDate: () => on('2026-01-10') } as Plant['createdAt'] };
  expect(stageTiming(legacy, on('2026-01-12'))).toEqual({ startedOn: '2025-12-23', estimated: true });
  expect(daysInStage(legacy, on('2026-01-12'))).toBe(20);
  expect(daysInStage(legacy, on('2026-01-13'))).toBe(21);
  expect(stageSuggestion(legacy, on('2026-01-15'))?.target).toBe('vegetative');
  expect(stageChangeFields(legacy, 'vegetative', '2026-01-15').stageStartedOnEstimated).toBe(false);
});
it('bases seedling timing on recorded emergence and postpones a rejection for seven days', () => {
  const seedling = { ...base, ...stageChangeFields(base, 'seedling', '2026-01-03') };
  expect(seedling.emergedOn).toBe('2026-01-03');
  expect(stageSuggestion(seedling, on('2026-01-16'))).toBeNull();
  const suggestion = stageSuggestion(seedling, on('2026-01-17'))!;
  const reviewed = { ...seedling, stageReview: { suggestionId: suggestion.id, action: 'not_yet' as const, nextCheckOn: '2026-01-24', snoozes: 0 } };
  expect(stageSuggestion(reviewed, on('2026-01-23'))).toBeNull();
  expect(stageSuggestion(reviewed, on('2026-01-24'))?.target).toBe('vegetative');
  expect(stageSuggestion(reviewed, on('2026-01-24'))?.pushOn).toBeUndefined();
});
it('asks once for unknown characteristics and suppresses dismissal until reset', () => {
  const plant = { ...base, growthStage: 'vegetative' as const };
  const suggestion = stageSuggestion(plant, on('2026-02-10'))!;
  expect(suggestion.kind).toBe('profile');
  expect(stageSuggestion({ ...plant, stageReview: { suggestionId: suggestion.id, action: 'dismiss', snoozes: 0, nextCheckOn: null } }, on('2026-03-10'))).toBeNull();
});
it('requires maturity, known profile, season, location and decreasing daylight for seasonal checks', () => {
  const plant = { ...base, growthStage: 'vegetative' as const, stageStartedOn: '2025-11-01', startedOn: '2025-10-01', growthProfile: { flowering: 'photoperiod' as const }, location: { lat: -26.2, lng: 28 } };
  expect(stageSuggestion(plant, on('2026-02-10'))?.target).toBe('flowering');
  expect(stageSuggestion(plant, on('2026-11-10'))).toBeNull();
  expect(stageSuggestion({ ...plant, startedOn: '2026-02-01' }, on('2026-02-10'))).toBeNull();
  expect(stageSuggestion({ ...plant, location: null }, on('2026-02-10'))?.kind).toBe('location');
  expect(stageSuggestion({ ...plant, location: { lat: 40, lng: -75 } }, on('2026-08-10'))?.target).toBe('flowering');
  expect(stageSuggestion({ ...plant, location: { lat: 0, lng: 28 } }, on('2026-02-10'))).toBeNull();
  expect(daylightHours(-26, '2026-02-10')).toBeLessThan(daylightHours(-26, '2026-02-03'));
});
it('uses the opt-in age profile only with a recorded germination date', () => {
  const plant = { ...base, growthStage: 'vegetative' as const, growthProfile: { flowering: 'age_based' as const } };
  expect(stageSuggestion(plant, on('2026-02-10'))).toBeNull();
  expect(stageSuggestion({ ...plant, germinationStartedOn: '2026-01-01' }, on('2026-01-29'))?.target).toBe('flowering');
});
it('checks an observed pre-flowering transition after seven days while remaining vegetative', () => {
  const plant = { ...base, growthStage: 'vegetative' as const, preflowerObservedOn: '2026-01-10' };
  expect(stageSuggestion(plant, on('2026-01-16'))).toBeNull();
  const check = stageSuggestion(plant, on('2026-01-17'))!;
  expect(check.target).toBe('flowering'); expect(check.repeatDays).toBe(14); expect(check.pushOn).toBeUndefined();
  expect(plant.growthStage).toBe('vegetative');
});
it('shows progress, harvest review and optional post-harvest checks without changing stages', () => {
  const plant = { ...base, growthStage: 'flowering' as const };
  expect(stageSuggestion(plant, on(addDays('2026-01-01', 41)))).toBeNull();
  expect(stageSuggestion(plant, on(addDays('2026-01-01', 42)))?.kind).toBe('progress');
  expect(stageSuggestion(plant, on(addDays('2026-01-01', 56)))?.kind).toBe('harvest');
  const drying = { ...plant, growthStage: 'drying' as const, status: 'harvested' as const };
  expect(stageSuggestion(drying, on('2026-01-15'))).toBeNull();
  expect(stageSuggestion({ ...drying, postHarvestTracking: true }, on('2026-01-15'))?.target).toBe('curing');
  expect(stageSuggestion({ ...plant, status: 'archived' }, on('2026-03-01'))).toBeNull();
  expect(plant.growthStage).toBe('flowering');
});
it('plans one optional push and only one explicit snooze, with spacing and quiet hours', () => {
  const plant = { ...base, stageReminders: { enabled: true, quietStartHour: 9, quietEndHour: 17 } };
  const now = on('2026-01-05');
  const plan = stagePushPlan(plant, now)!;
  expect(new Date(plan.dueAt).toISOString()).toBe('2026-01-11T15:00:00.000Z');
  // Day 10 from January 1 is January 11; first permitted local hour is 17:00.
  expect(stagePushPlan({ ...plant, stagePush: plan }, on('2026-02-01'))).toBeNull();
  const review = { suggestionId: plan.suggestionId, action: 'snooze' as const, nextCheckOn: '2026-01-12', snoozes: 1 };
  const extra = stagePushPlan({ ...plant, stagePush: plan, stageReview: review }, on('2026-01-12'))!;
  expect(extra.dueAt).toBeGreaterThanOrEqual(plan.dueAt + 7 * 86400000);
  expect(stagePushPlan({ ...plant, stageReview: { ...review, snoozes: 2 } }, on('2026-02-01'))).toBeNull();
  expect(stagePushPlan({ ...plant, stageReminders: { enabled: false } }, now)).toBeNull();
});
