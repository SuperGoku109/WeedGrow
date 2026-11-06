import { getFirestore } from 'firebase-admin/firestore';
import type { Plant } from '../../firestoreModels';
import { plantSetup } from '../../lib/careAlgorithm/appAdapter';
import type { Profile, Setup } from '../../lib/careAlgorithm/types';
import { careInputKey } from '../../lib/careAlgorithm/snapshot';
import { revisionFingerprint } from '../../lib/careAlgorithm/revisions';
import { selectWaterHistory } from '../../lib/careAlgorithm/historySelection';
import { makeWaterCheckpoint, type WaterCheckpoint } from '../../lib/careAlgorithm/checkpoint';
import { replayWater, type ReplayInput } from '../../lib/careAlgorithm/replay';
import { resumeWaterCheckpoint } from '../../lib/careAlgorithm/checkpoint';
import { readWaterEvents } from './careEventLedger';
import { readSetupTransitions } from './careStateLedger';
import { approvedWaterProfiles, selectWaterProfile, type WaterPolicy } from './careWaterPolicy';
import { loadWaterHistory, historyModelSelection } from './careWaterHistory';

interface WaterOrigin { schemaVersion: 1; anchorUtc: number; setup: Setup; profile: Profile; coordinates: { lat: number; lng: number } }
/** Builds the actual production replay input. Missing evidence is a reason, never a timer fallback. */
export async function preparePlantWater(plantId: string, plant: Plant, policy: WaterPolicy, nowUtc: number, request: typeof fetch, clock: () => number) {
  const approvedProfiles = approvedWaterProfiles(policy); const setup = plantSetup(plant); const profile = selectWaterProfile(setup, approvedProfiles);
  const fail = (reason: string) => ({ profile, approvedProfiles, replay: undefined as ReplayInput | undefined, reasonCodes: [reason], checkpoint: null as WaterCheckpoint | null });
  if (!profile) return fail('approved_profile_domain_unavailable_or_ambiguous');
  if (plant.status !== 'active' || plant.deleting || setup.environment !== 'outdoor' || !plant.location) return fail('water_setup_inapplicable');
  const db = getFirestore(); const parent = db.doc(`plants/${plantId}`); const state = parent.collection('careWaterState');
  const originRef = state.doc('origin'); const originDoc = await originRef.get();
  let origin = originDoc.data() as WaterOrigin | undefined;
  if (!origin) {
    origin = { schemaVersion: 1, anchorUtc: nowUtc, setup, profile, coordinates: plant.location };
    const created = origin;
    await db.runTransaction(async tx => {
      const [current, saved] = await Promise.all([tx.get(parent), tx.get(originRef)]);
      if (!current.exists || current.data()?.deleting || careInputKey(current.data() as Plant) !== careInputKey(plant) || saved.exists) return;
      tx.set(originRef, JSON.parse(revisionFingerprint(created)));
    });
    // Never assume the plant was full at activation, nor invent its past setup date.
    return fail('water_origin_initialized_unanchored');
  }
  if (origin.schemaVersion !== 1 || !Number.isFinite(origin.anchorUtc) || origin.anchorUtc > nowUtc) return fail('water_origin_invalid');
  const setups = await readSetupTransitions(plantId, nowUtc);
  if (!setups.complete) return fail(setups.reasonCodes[0]);
  const dated = setups.facts.filter(row => row.effectiveUtc > origin!.anchorUtc && row.effectiveUtc <= nowUtc);
  let previousSetup = origin.setup; let previousProfile = origin.profile;
  const transitions: NonNullable<ReplayInput['transitions']>[number][] = [];
  for (const fact of dated) {
    if (revisionFingerprint(fact.before?.setup) !== revisionFingerprint(previousSetup)) return fail('water_setup_history_gap');
    const nextSetup = fact.after.setup as Setup; const nextProfile = selectWaterProfile(nextSetup, approvedProfiles);
    if (!nextProfile) return fail('historical_profile_domain_unavailable');
    if (nextSetup.locationRevision !== previousSetup.locationRevision) {
      // An unmodeled move cannot transfer location history. Reinitialize unknown at its recorded boundary.
      const reset: WaterOrigin = { schemaVersion: 1, anchorUtc: fact.effectiveUtc, setup: nextSetup, profile: nextProfile, coordinates: fact.after.location };
      if (!reset.coordinates) return fail('water_transition_location_unavailable');
      origin = reset; transitions.length = 0;
    } else {
      const lineage = (policy.carryMappings ?? []).filter(m => m.fromProfile === `${previousProfile.id}@${previousProfile.version}` && m.toProfile === `${nextProfile.id}@${nextProfile.version}`);
      const sameProfile = revisionFingerprint(previousProfile) === revisionFingerprint(nextProfile);
      const scenarioMap = sameProfile ? Object.fromEntries(previousProfile.scenarios.map(s => [s.id, s.id])) : lineage.length === 1 ? lineage[0].scenarioMap : undefined;
      const carry = !!scenarioMap && previousProfile.rootZoneKey === nextProfile.rootZoneKey && previousSetup.plantedIn === nextSetup.plantedIn
        && previousSetup.potVolumeL === nextSetup.potVolumeL && previousSetup.medium === nextSetup.medium;
      transitions.push({ atUtc: fact.effectiveUtc, setup: nextSetup, profile: nextProfile, mode: carry ? 'carry' : 'reinitialize',
        ...(carry ? { scenarioMap } : {}) });
    }
    previousSetup = nextSetup; previousProfile = nextProfile;
  }
  if (revisionFingerprint(previousSetup) !== revisionFingerprint(setup) || revisionFingerprint(previousProfile) !== revisionFingerprint(profile)) return fail('water_setup_history_not_synchronized');
  const events = await readWaterEvents(plantId, nowUtc);
  if (!events.complete) return fail(events.reasonCodes[0]);
  const requiresRain = origin.setup.soilRain !== 'no' || transitions.some(t => t.setup.soilRain !== 'no');
  const history = await loadWaterHistory(plantId, origin.coordinates, origin.setup.locationRevision, origin.anchorUtc, nowUtc, policy, request, clock, requiresRain);
  const replayAt = clock();
  const selected = selectWaterHistory(history.samples, historyModelSelection(policy), origin.setup.locationRevision, replayAt);
  const replay: ReplayInput = { setup, profile, evaluationUtc: replayAt, anchorUtc: origin.anchorUtc, anchored: false,
    setupAtAnchor: origin.setup, profileAtAnchor: origin.profile, transitions, events: events.events,
    weather: selected.samples, et0Source: selected.et0Source, rainSource: selected.rainSource };
  const saved = (await state.doc('checkpoint').get()).data()?.checkpoint as WaterCheckpoint | undefined;
  const restored = saved ? resumeWaterCheckpoint(replay, saved) : { input: replay, reasonCodes: [] };
  let checkpoint: WaterCheckpoint | null = null;
  try { const result = replayWater(restored.input); if (result.states.length) checkpoint = makeWaterCheckpoint(replay, result.states); }
  catch { return fail('water_replay_input_invalid'); }
  return { profile, approvedProfiles, replay: restored.input, checkpoint, reasonCodes: [...restored.reasonCodes, ...history.reasonCodes] };
}
