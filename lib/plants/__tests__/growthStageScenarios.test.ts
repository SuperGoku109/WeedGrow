import type { Plant } from '@/firestoreModels';
import { addDays } from '@/lib/dates/plantDay';
import { daylightIsShortening, recordedStageReview, stageChangeFields, stagePushPlan, stageReminderSuggestion, stageSuggestion } from '../growthTracking';
import { stageTiming } from '../stageAgeDefaults';
const now = (day: string) => new Date(day + 'T12:00:00Z');
const base = { name: 'Plant', growthStage: 'seedling', stageStartedOn: '2026-01-01', status: 'active', owners: ['u'], environment: 'outdoor', locationTimeZone: 'Africa/Johannesburg' } as Plant;
const selected = (plant: Plant, day: string): Plant => ({ ...plant, lastStageReviewedOn: day, stageReview: recordedStageReview(plant, day) });

it('treats estimated seedling day 18 as reviewed and checks at day 21, with no immediate push', () => {
  const plant = selected({ ...base, stageStartedOnEstimated: true, stageReminders: { enabled: true } }, '2026-01-19');
  expect(stageSuggestion(plant, now('2026-01-19'))).toBeNull();
  expect(stageSuggestion(plant, now('2026-01-21'))).toBeNull();
  expect(stageSuggestion(plant, now('2026-01-22'))?.target).toBe('vegetative');
  const planned = stagePushPlan(plant, now('2026-01-19'))!;
  expect(planned.dueAt).toBe(Date.parse('2026-01-22T08:00:00Z'));
});
it('uses the next germination and flowering milestones rather than prompting immediately after setup', () => {
  const germ = selected({ ...base, growthStage: 'germination' }, '2026-01-08');
  expect(stageSuggestion(germ, now('2026-01-08'))).toBeNull();
  expect(stageSuggestion(germ, now('2026-01-11'))?.target).toBe('seedling');
  const today = '2026-04-01';
  const flower = selected({ ...base, growthStage: 'flowering', stageStartedOn: addDays(today, -70), stageReminders: { enabled: true } }, today);
  expect(stageSuggestion(flower, now(today))).toBeNull();
  expect(stageSuggestion(flower, now(addDays(today, 7)))?.kind).toBe('harvest');
  expect(stagePushPlan(flower, now(today))!.dueAt).toBe(Date.parse(addDays(today, 7) + 'T08:00:00Z'));
});
it('respects a backdated confirmation while counting today as the review date', () => {
  const fields = stageChangeFields(base, 'flowering', '2026-01-01', '2026-03-12'); // Flowering day 70.
  const plant = { ...base, ...fields };
  expect(stageSuggestion(plant, now('2026-03-12'))).toBeNull();
  expect(stageSuggestion(plant, now('2026-03-19'))?.kind).toBe('harvest');
});
it('does not let a dismissed progress check hide the later harvest-readiness check', () => {
  const plant = { ...base, growthStage: 'flowering' as const, stageReminders: { enabled: true } };
  const progress = stageSuggestion(plant, now('2026-02-12'))!;
  const reviewed: Plant = { ...plant, lastStageReviewedOn: '2026-02-12', stageReview: { suggestionId: progress.id, action: 'dismiss', nextCheckOn: null, snoozes: 0 } };
  expect(stageSuggestion(reviewed, now('2026-02-13'))).toBeNull();
  const harvest = stageSuggestion(reviewed, now('2026-02-26'))!;
  expect(harvest.kind).toBe('harvest'); expect(harvest.id).not.toBe(progress.id);
  expect(stageReminderSuggestion(reviewed, now('2026-02-12'))?.id).toBe(harvest.id);
  expect(stageSuggestion({ ...reviewed, stageReview: { ...reviewed.stageReview!, suggestionId: harvest.id } }, now('2026-03-20'))).toBeNull();
});
it('prevents a new readiness prompt immediately after a late progress response', () => {
  const plant = { ...base, growthStage: 'flowering' as const };
  const progress = stageSuggestion(plant, now('2026-02-25'))!;
  const reviewed: Plant = { ...plant, lastStageReviewedOn: '2026-02-25', stageReview: { suggestionId: progress.id, action: 'not_yet', nextCheckOn: '2026-03-18', snoozes: 0 } };
  expect(stageSuggestion(reviewed, now('2026-02-26'))).toBeNull();
  expect(stageSuggestion(reviewed, now('2026-03-04'))?.kind).toBe('harvest');
});
const outdoor = { ...base, growthStage: 'vegetative' as const, startedOn: '2025-10-01', stageStartedOn: '2025-11-01', growthProfile: { flowering: 'photoperiod' as const }, location: { lat: -26, lng: 28 } };
it('uses sustained shortening daylight in both hemispheres without fixed month or latitude defaults', () => {
  expect(stageSuggestion(outdoor, now('2026-05-10'))?.target).toBe('flowering'); // Outside the removed Jan–Apr default.
  expect(stageSuggestion({ ...outdoor, location: { lat: -5, lng: 28 } }, now('2026-05-10'))?.target).toBe('flowering');
  expect(stageSuggestion({ ...outdoor, location: { lat: 40, lng: -75 } }, now('2026-11-10'))?.target).toBe('flowering');
  expect(stageSuggestion(outdoor, now('2026-11-10'))).toBeNull();
  expect(daylightIsShortening(0, '2026-05-10')).toBe(false);
  expect(stageSuggestion({ ...outdoor, growthProfile: { flowering: 'photoperiod', floweringMonths: [1] } }, now('2026-05-10'))).toBeNull();
});
it('requires the supplied 60-day vegetative minimum for a seasonal check, while actual early signs take priority', () => {
  const plant = { ...outdoor, stageStartedOn: '2026-01-01' };
  expect(stageSuggestion(plant, now('2026-03-01'))).toBeNull(); // Day 59.
  expect(stageSuggestion(plant, now('2026-03-02'))?.target).toBe('flowering');
  const observed = selected({ ...plant, preflowerObservedOn: '2026-01-03' }, '2026-01-04');
  const earlyReview: Plant = { ...observed, stageReview: { suggestionId: 'vegetative:2026-01-01:0:preflower:2026-01-03', action: 'early_signs', nextCheckOn: '2026-01-11', snoozes: 0 } };
  expect(stageSuggestion(earlyReview, now('2026-01-11'))?.target).toBe('flowering');
});
it('asks for missing setup and allows a new seasonal phase after the profile request was dismissed', () => {
  const unknown = { ...outdoor, growthProfile: undefined };
  const profile = stageSuggestion(unknown, now('2026-02-10'))!;
  expect(profile.kind).toBe('profile');
  const reviewed: Plant = { ...unknown, stageReview: { suggestionId: profile.id, action: 'dismiss', nextCheckOn: null, snoozes: 0 } };
  expect(stageSuggestion(reviewed, now('2026-02-10'))).toBeNull();
  expect(stageSuggestion({ ...reviewed, growthProfile: { flowering: 'photoperiod' } }, now('2026-02-10'))?.target).toBe('flowering');
  expect(stageSuggestion({ ...outdoor, location: null }, now('2026-02-10'))?.kind).toBe('location');
});
it('keeps the legacy stage clock stable when only the total age recording date changes', () => {
  const plant = { ...base, stageStartedOn: undefined, createdAt: { toDate: () => now('2026-01-01') } as Plant['createdAt'] };
  const original = stageTiming(plant, now('2026-02-01'));
  expect(stageTiming({ ...plant, ageRecordedAt: { toDate: () => now('2026-01-31') } as Plant['ageRecordedAt'] }, now('2026-02-01'))).toEqual(original);
});
