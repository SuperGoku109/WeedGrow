import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import type { Plant } from '@/firestoreModels';
import { addDays, plantDay, zonedTime } from '@/lib/dates/plantDay';
import { validateLogDate } from '@/lib/logs/plantJournal';
import { newLogId } from '@/lib/logs/journalRepository';
import { stageChangeFields, stageSuggestion, preflowerSuggestionId, type StageReview, type StageReviewAction } from '@/lib/plants/growthTracking';
import { assertValidPlantFields } from '@/lib/plants/plantValidation';
import { assertGrowthDates } from '@/lib/plants/growthDates';
import { STAGE_DURATION_RANGES } from '@/lib/plants/stageAgeDefaults';
import { assertLivingGrowthChange, livingGrowthEnded, POST_HARVEST_STAGES } from '@/lib/plants/growthLifecycle';

export async function confirmGrowthStage(plantId: string, stage: Plant['growthStage'], date: string, expectedRevision = 0, requestId = newLogId()) {
  const uid = requireUserId();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId);
    const logRef = doc(db, 'plants', plantId, 'logs', `stage_${requestId}`);
    const current = await tx.get(ref); const previousLog = await tx.get(logRef);
    if (!current.exists() || !current.data().owners?.includes(uid)) throw new Error('This plant is not in your account.');
    if (previousLog.exists()) return;
    const plant = current.data() as Plant;
    if (plant.deleting || !['active', 'harvested'].includes(plant.status)) throw new Error('Restore this plant before updating its growth stage.');
    if ((plant.stageRevision || 0) !== expectedRevision) throw new Error('The stage has changed. Refresh and review it again.');
    assertLivingGrowthChange(plant, { growthStage: stage });
    if (stage === 'harvested' && !livingGrowthEnded(plant)) throw new Error('Use Record harvest to save the harvest date and journal entry.');
    if (['drying', 'curing', 'completed'].includes(stage) && !plant.harvestedOn && !plant.harvest) throw new Error('Record a harvest before starting post-harvest tracking.');
    const error = validateLogDate(date, plantDay(new Date(), plant.locationTimeZone));
    if (error) throw new Error(error);
    const fields = stageChangeFields(plant, stage, date, plantDay(new Date(), plant.locationTimeZone));
    if (stage === 'harvested') fields.harvest = { ...(plant.harvest || { notes: '', recordId: requestId }), date };
    assertValidPlantFields(fields, plantDay(new Date(), plant.locationTimeZone));
    assertGrowthDates(plant, fields, plantDay(new Date(), plant.locationTimeZone));
    tx.update(ref, { ...fields, lastStageReviewedOn: plantDay(new Date(), plant.locationTimeZone),
      ...(!(POST_HARVEST_STAGES as readonly string[]).includes(stage) ? { status: 'active', postHarvestTracking: false } : {}),
      ...(stage === 'harvested' ? { status: 'harvested', postHarvestTracking: false } : {}),
      ...(['drying', 'curing'].includes(stage) ? { postHarvestTracking: true, status: 'harvested' } : {}),
      ...(stage === 'completed' ? { postHarvestTracking: false, status: 'harvested' } : {}), updatedAt: serverTimestamp() });
    if (stage === 'harvested' && fields.harvest) tx.set(doc(db, 'plants', plantId, 'logs', `harvest_${fields.harvest.recordId}`), {
      type: 'harvest', harvest: fields.harvest, calendarDay: date, occurrencePrecision: 'date',
      ...(plant.locationTimeZone ? { timeZone: plant.locationTimeZone } : {}), timestamp: Timestamp.fromDate(zonedTime(date, '12:00', plant.locationTimeZone)), editedAt: serverTimestamp(), updatedBy: uid,
    }, { merge: true });
    tx.set(logRef, { type: 'stage_change', fromStage: plant.growthStage, toStage: stage, stageRevision: fields.stageRevision,
      description: `${plant.growthStage} → ${stage}${plant.growthStage === stage ? ' (stage start date recorded)' : ''}`,
      calendarDay: date, ...(plant.locationTimeZone ? { timeZone: plant.locationTimeZone } : {}), occurrencePrecision: 'date',
      timestamp: Timestamp.fromDate(zonedTime(date, '12:00', plant.locationTimeZone)), recordedAt: serverTimestamp(), updatedBy: uid });
  });
}

export async function reviewGrowthSuggestion(plantId: string, suggestionId: string, action: StageReviewAction, requestId = newLogId()) {
  const uid = requireUserId();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId); const logRef = doc(db, 'plants', plantId, 'logs', `review_${requestId}`);
    const current = await tx.get(ref); const previousLog = await tx.get(logRef);
    if (!current.exists() || !current.data().owners?.includes(uid)) throw new Error('This plant is not in your account.');
    if (previousLog.exists()) return;
    const plant = current.data() as Plant;
    const now = new Date();
    const suggestion = stageSuggestion(plant, now);
    if (!suggestion || suggestion.id !== suggestionId) throw new Error('This suggestion has changed. Review the current stage again.');
    if (action === 'early_signs' && plant.growthStage !== 'vegetative') throw new Error('Early flowering signs apply to vegetative plants.');
    const today = plantDay(now, plant.locationTimeZone);
    const oldSnoozes = plant.stageReview?.suggestionId === suggestionId ? plant.stageReview.snoozes : 0;
    const review: StageReview = { suggestionId: action === 'early_signs' ? preflowerSuggestionId(plant, plant.preflowerObservedOn || today, now) : suggestionId, action, snoozes: oldSnoozes + (action === 'snooze' ? 1 : 0),
      nextCheckOn: action === 'dismiss' ? null : addDays(today, action === 'early_signs' ? STAGE_DURATION_RANGES.preflower.min : action === 'snooze' ? 7 : suggestion.repeatDays) };
    tx.update(ref, { stageReview: review, lastStageReviewedOn: today, ...(action === 'early_signs' ? { preflowerObservedOn: plant.preflowerObservedOn || today } : {}), updatedAt: serverTimestamp() });
    tx.set(logRef, { type: 'note', category: 'notes', stageReview: review, description: action === 'early_signs' ? 'Signs of pre-flowering observed. Stage remains vegetative.' : `Growth stage reviewed: ${action.replace('_', ' ')}.`,
      calendarDay: today, ...(plant.locationTimeZone ? { timeZone: plant.locationTimeZone } : {}), timestamp: serverTimestamp(), updatedBy: uid });
  });
}

/** A direct observation can be recorded without waiting for a seasonal suggestion. */
export async function recordPreflowerObservation(plantId: string, date: string, expectedRevision: number, requestId = newLogId()) {
  const uid = requireUserId();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId); const logRef = doc(db, 'plants', plantId, 'logs', `preflower_${requestId}`);
    const current = await tx.get(ref); const existing = await tx.get(logRef);
    if (!current.exists() || !current.data().owners?.includes(uid)) throw new Error('This plant is not in your account.');
    if (existing.exists()) return;
    const plant = current.data() as Plant;
    if (plant.deleting || plant.status !== 'active' || plant.growthStage !== 'vegetative' || livingGrowthEnded(plant)) throw new Error('Early flowering signs can be recorded for a living vegetative plant.');
    if ((plant.stageRevision || 0) !== expectedRevision) throw new Error('The stage has changed. Refresh and review it again.');
    const now = new Date(); const today = plantDay(now, plant.locationTimeZone);
    const invalidDate = validateLogDate(date, today);
    if (invalidDate) throw new Error(invalidDate);
    if (plant.emergedOn && date < plant.emergedOn || !plant.stageStartedOnEstimated && plant.stageStartedOn && date < plant.stageStartedOn) throw new Error('Early signs cannot be before the recorded emergence or vegetative start. Correct the dates and try again.');
    const stageReview: StageReview = { suggestionId: preflowerSuggestionId(plant, date, now), action: 'early_signs', nextCheckOn: addDays(today, STAGE_DURATION_RANGES.preflower.min), snoozes: 0 };
    tx.update(ref, { preflowerObservedOn: date, lastStageReviewedOn: today, stageReview, updatedAt: serverTimestamp() });
    tx.set(logRef, { type: 'note', category: 'notes', stageReview, description: 'Early flowering signs observed. Stage remains vegetative.', calendarDay: date,
      ...(plant.locationTimeZone ? { timeZone: plant.locationTimeZone } : {}), occurrencePrecision: 'date', timestamp: Timestamp.fromDate(zonedTime(date, '12:00', plant.locationTimeZone)), recordedAt: serverTimestamp(), updatedBy: uid });
  });
}
