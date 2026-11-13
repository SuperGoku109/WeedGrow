import { doc, arrayRemove, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { requireUserId } from '@/services/session';
import type { Plant } from '@/firestoreModels';
import { addDays, plantDay, zonedTime } from '@/lib/dates/plantDay';
import { validateLogDate } from '@/lib/logs/plantJournal';
import { validateMeasurements } from '@/lib/logs/logMeasurements';
import { assertUnchanged } from '@/lib/plants/editConflict';
import { normalizePlantSetup } from '@/lib/plants/plantRules';
import { plantEditHistory } from '@/lib/plants/plantEditHistory';
import { growthPhase, phaseWindow } from '@/lib/plants/growthPhase';
import { newLogId } from '@/lib/logs/journalRepository';
import { stageChangeFields, stageSuggestion, preflowerSuggestionId, type StageReview, type StageReviewAction } from '@/lib/plants/growthTracking';
import { assertValidPlantFields } from '@/lib/plants/plantValidation';
import { assertGrowthDates } from '@/lib/plants/growthDates';
import { STAGE_DURATION_RANGES, stageTiming } from '@/lib/plants/stageAgeDefaults';
import { assertLivingGrowthChange, livingGrowthEnded, POST_HARVEST_STAGES } from '@/lib/plants/growthLifecycle';

export interface GrowthPhaseDetails { lateFlowering?: boolean; harvest?: boolean; setup?: Partial<Pick<Plant, 'environment' | 'plantedIn' | 'potSize' | 'potMaterial' | 'careMedium' | 'sunlightExposure'>>; measurements?: { ph?: number; heightCm?: number; soilMoisture?: number }; baseline?: Plant }

export async function confirmGrowthStage(plantId: string, stage: Plant['growthStage'], date: string, expectedRevision = 0, requestId = newLogId(), details?: GrowthPhaseDetails) {
  if (details?.harvest && stage !== 'harvested') throw new Error('Harvest must finish living growth.');
  const uid = requireUserId();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'plants', plantId);
    const logRef = doc(db, 'plants', plantId, 'logs', details?.harvest ? `harvest_${requestId}` : `stage_${requestId}`);
    const current = await tx.get(ref); const previousLog = await tx.get(logRef);
    if (!current.exists() || !current.data().owners?.includes(uid)) throw new Error('This plant is not in your account.');
    if (previousLog.exists()) {
      if (details && previousLog.data()?.phaseMutation !== JSON.stringify({ stage, date, late: !!details.lateFlowering, setup: details.setup || {}, measurements: details.measurements || {} })) throw new Error('This update was already saved with different details. Close and review the plant before changing it again.');
      return;
    }
    const plant = current.data() as Plant;
    if (plant.deleting || !['active', 'harvested'].includes(plant.status)) throw new Error('Restore this plant before updating its growth stage.');
    if ((plant.stageRevision || 0) !== expectedRevision) throw new Error('The stage has changed. Refresh and review it again.');
    assertLivingGrowthChange(plant, { growthStage: stage });
    if (stage === 'harvested' && !livingGrowthEnded(plant) && !details?.harvest) throw new Error('Use Record harvest to save the harvest date and journal entry.');
    if (['drying', 'curing', 'completed'].includes(stage) && !plant.harvestedOn && !plant.harvest) throw new Error('Record a harvest before starting post-harvest tracking.');
    const error = validateLogDate(date, plantDay(new Date(), plant.locationTimeZone));
    if (error) throw new Error(error);
    const fields = stageChangeFields(plant, stage, date, plantDay(new Date(), plant.locationTimeZone));
    const setup = details?.setup || {};
    const allowed = ['environment', 'plantedIn', 'potSize', 'potMaterial', 'careMedium', 'sunlightExposure'];
    if (Object.keys(setup).some(key => !allowed.includes(key))) throw new Error('Unsupported setup change.');
    const normalized = normalizePlantSetup(setup, plant);
    assertUnchanged(plant as unknown as Record<string, unknown>, normalized, details?.baseline as unknown as Record<string, unknown>);
    const measurements = details?.measurements || {};
    if (Object.keys(measurements).some(key => !['ph', 'heightCm', 'soilMoisture'].includes(key))) throw new Error('Unsupported measurement.');
    validateMeasurements(measurements);
    if (details?.lateFlowering) {
      if (stage !== 'flowering') throw new Error('Late flowering belongs to the flowering stage.');
      const floweringStart = plant.floweringStartedOn || (plant.growthStage === 'flowering' ? plant.stageStartedOn : null) || date;
      if (date < floweringStart) throw new Error('Late flowering cannot start before flowering.');
      Object.assign(fields, { floweringPhase: 'late', lateFloweringStartedOn: date, floweringStartedOn: floweringStart, stageStartedOn: floweringStart });
      for (const key of ['startedOn', 'ageDays', 'ageKnown', 'ageEstimated', 'ageEstimateSource'] as const) delete fields[key];
      if (plant.growthStage !== 'flowering' && !plant.floweringStartedOn) Object.assign(fields, { floweringStartedOn: null, stageStartedOnEstimated: true });
    } else if (stage === 'flowering' || !['harvested', 'drying', 'curing', 'completed'].includes(stage)) Object.assign(fields, { floweringPhase: null, lateFloweringStartedOn: null });
    const originalPhaseStart = growthPhase(plant) === 'late_flowering' ? plant.lateFloweringStartedOn || stageTiming(plant).startedOn : stageTiming(plant).startedOn;
    if (details && (details.lateFlowering ? 'late_flowering' : stage) === growthPhase(plant) && date === originalPhaseStart) fields.stageStartedOnEstimated = plant.stageStartedOnEstimated ?? !plant.stageStartedOn;
    if (details) for (const key of ['startedOn', 'ageDays', 'ageKnown', 'ageEstimated', 'ageEstimateSource'] as const) delete fields[key];
    const latestReadings = date === plantDay(new Date(), plant.locationTimeZone) ? { ...(measurements.heightCm != null ? { height: measurements.heightCm } : {}), ...(measurements.ph != null ? { soilPh: String(measurements.ph) } : {}) } : {};
    assertUnchanged(plant as unknown as Record<string, unknown>, latestReadings, details?.baseline as unknown as Record<string, unknown>);
    Object.assign(fields, normalized, latestReadings);
    const changedGarden = !!(setup.environment && setup.environment !== plant.environment && plant.groupId);
    const groupRef = changedGarden ? doc(db, 'groups', plant.groupId!) : null;
    const group = groupRef ? await tx.get(groupRef) : null;
    if (group?.exists() && group.data().createdBy !== uid) throw new Error('The garden is not in your account.');
    if (changedGarden) Object.assign(fields, { groupId: null, locationMode: 'custom' });
    if (details?.harvest) Object.assign(fields, { harvest: { date, notes: '', recordId: requestId }, wateringRepeat: null });

    if (stage === 'harvested') fields.harvest = { ...(plant.harvest || { notes: '', recordId: requestId }), date };
    assertValidPlantFields(fields, plantDay(new Date(), plant.locationTimeZone));
    assertGrowthDates(plant, fields, plantDay(new Date(), plant.locationTimeZone));
    tx.update(ref, { ...fields, lastStageReviewedOn: plantDay(new Date(), plant.locationTimeZone),
      ...(!(POST_HARVEST_STAGES as readonly string[]).includes(stage) ? { status: 'active', postHarvestTracking: false } : {}),
      ...(stage === 'harvested' ? { status: 'harvested', postHarvestTracking: false } : {}),
      ...(['drying', 'curing'].includes(stage) ? { postHarvestTracking: true, status: 'harvested' } : {}),
      ...(stage === 'completed' ? { postHarvestTracking: false, status: 'harvested' } : {}), updatedAt: serverTimestamp() });
    if (changedGarden && groupRef && group?.exists()) tx.update(groupRef, { plantIds: arrayRemove(plantId), ...(group.data().weatherSourcePlantId === plantId ? { weatherSourcePlantId: null } : {}), updatedAt: serverTimestamp() });
    const phaseMutation = details ? JSON.stringify({ stage, date, late: !!details.lateFlowering, setup, measurements }) : undefined;
    const setupDescription = plantEditHistory(plant, normalized);
    if (setupDescription) tx.set(doc(db, 'plants', plantId, 'logs', `phase_setup_${requestId}`), { type: 'note', historyEvent: 'setup', description: setupDescription, calendarDay: date, occurrencePrecision: 'date', ...(plant.locationTimeZone ? { timeZone: plant.locationTimeZone } : {}), timestamp: Timestamp.fromDate(zonedTime(date, '12:00', plant.locationTimeZone)), recordedAt: serverTimestamp(), updatedBy: uid });
    if (stage === 'harvested' && fields.harvest) tx.set(doc(db, 'plants', plantId, 'logs', `harvest_${fields.harvest.recordId}`), {
      type: 'harvest', harvest: fields.harvest, ...(phaseMutation ? { phaseMutation } : {}), calendarDay: date, occurrencePrecision: 'date',
      ...(plant.locationTimeZone ? { timeZone: plant.locationTimeZone } : {}), timestamp: Timestamp.fromDate(zonedTime(date, '12:00', plant.locationTimeZone)), editedAt: serverTimestamp(), updatedBy: uid,
    }, { merge: true });
    if (Object.keys(measurements).length) tx.set(doc(db, 'plants', plantId, 'logs', `phase_measurements_${requestId}`), { type: 'note', category: 'measurements', ...measurements, description: '', calendarDay: date, occurrencePrecision: 'date', ...(plant.locationTimeZone ? { timeZone: plant.locationTimeZone } : {}), timestamp: Timestamp.fromDate(zonedTime(date, '12:00', plant.locationTimeZone)), recordedAt: serverTimestamp(), updatedBy: uid });
    if (!details?.harvest) tx.set(logRef, { type: 'stage_change', fromStage: plant.growthStage, toStage: stage, stageRevision: fields.stageRevision,
      ...(phaseMutation ? { phaseMutation, fromPhase: growthPhase(plant), toPhase: details?.lateFlowering ? 'late_flowering' : stage } : {}),
      description: details ? `${phaseWindow(growthPhase(plant))?.label || plant.growthStage} → ${phaseWindow(details.lateFlowering ? 'late_flowering' : stage)?.label || stage}` : `${plant.growthStage} → ${stage}${plant.growthStage === stage ? ' (stage start date recorded)' : ''}`,
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
