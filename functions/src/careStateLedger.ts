import { createHash } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import type { Plant } from '../../firestoreModels';
import { plantSetup } from '../../lib/careAlgorithm/appAdapter';
import { careInputKey } from '../../lib/careAlgorithm/snapshot';
import { revisionFingerprint } from '../../lib/careAlgorithm/revisions';
import { runWaterModel, type WaterModelInput } from '../../lib/careAlgorithm/waterModel';
import { makeWaterCheckpoint, type WaterCheckpoint } from '../../lib/careAlgorithm/checkpoint';
import { readWaterEvents, synchronizeWaterEvents } from './careEventLedger';

const facts = (plant: Plant) => ({ setup: plantSetup(plant), location: plant.location ?? null });
/** Exact source-write boundary comes from Firestore metadata; arrival order is not effective order. */
export async function captureSetupTransition(plantId: string, before: Plant | null, after: Plant, effectiveUtc: number, sourceRevision: string, clock: () => number = () => Date.now() / 1000) {
  if (before && revisionFingerprint(facts(before)) === revisionFingerprint(facts(after))) return false;
  const availableUtc = clock();
  if (!Number.isFinite(effectiveUtc) || !Number.isFinite(availableUtc) || effectiveUtc > availableUtc || !sourceRevision) throw new Error('invalid_setup_transition_metadata');
  const record = { schemaVersion: 1, effectiveUtc, sourceRevision, availableUtc, before: before ? facts(before) : null, after: facts(after) };
  const id = createHash('sha256').update(revisionFingerprint([sourceRevision, record.before, record.after])).digest('hex');
  const parent = getFirestore().doc(`plants/${plantId}`); const ref = parent.collection('careTransitions').doc(id);
  return getFirestore().runTransaction(async tx => {
    const [plant, previous] = await Promise.all([tx.get(parent), tx.get(ref)]);
    if (!plant.exists || plant.data()?.deleting || previous.exists) return false;
    // Optional setup facts must be omitted from the persisted JSON, not written as undefined.
    tx.set(ref, JSON.parse(revisionFingerprint(record)));
    tx.update(parent, { setupLedgerRevision: (plant.data()?.setupLedgerRevision ?? 0) + 1 });
    return true;
  });
}
export async function readSetupTransitions(plantId: string, asOfUtc: number, maxRecords = 2000) {
  if (!Number.isFinite(asOfUtc) || !Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 10000) throw new Error('invalid_transition_read');
  const snapshot = await getFirestore().collection(`plants/${plantId}/careTransitions`).limit(maxRecords + 1).get();
  if (snapshot.size > maxRecords) return { facts: [], complete: false, reasonCodes: ['transition_history_read_limit'] };
  const rows = snapshot.docs.map(doc => doc.data()).filter(row => row.availableUtc <= asOfUtc).sort((a, b) => a.effectiveUtc - b.effectiveUtc);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].effectiveUtc === rows[i - 1].effectiveUtc || revisionFingerprint(rows[i].before) !== revisionFingerprint(rows[i - 1].after)) {
      return { facts: rows, complete: false, reasonCodes: ['transition_history_conflict_or_gap'] };
    }
  }
  return { facts: rows, complete: true, reasonCodes: [] };
}

export type ShadowWaterPlan = Omit<WaterModelInput, 'setup' | 'events' | 'evaluationUtc' | 'checkpoint'>;
/** Staff/research entry point only; never a callable client endpoint or a production watering approval. */
export async function recordShadowWaterRun(plantId: string, plan: ShadowWaterPlan, clock: () => number = () => Date.now() / 1000) {
  const db = getFirestore(); const parent = db.doc(`plants/${plantId}`);
  const first = await parent.get();
  if (!first.exists || first.data()?.deleting || first.data()?.status !== 'active') return false;
  await synchronizeWaterEvents(plantId, 2000, clock);
  const plant = (await parent.get()).data() as Plant | undefined;
  if (!plant || plant.deleting || plant.status !== 'active') return false;
  const evaluationUtc = clock(); const key = careInputKey(plant);
  const events = await readWaterEvents(plantId, evaluationUtc);
  const setups = await readSetupTransitions(plantId, evaluationUtc);
  const initial = setups.facts.filter(row => row.effectiveUtc <= plan.anchorUtc).at(-1)?.after;
  const expected = plan.setupAtAnchor ?? plantSetup(plant);
  const dated = setups.facts.filter(row => row.effectiveUtc > plan.anchorUtc && row.effectiveUtc <= evaluationUtc);
  const transitionPlan = plan.transitions ?? [];
  const setupMatches = setups.complete && !!initial && revisionFingerprint(initial.setup) === revisionFingerprint(expected)
    && dated.length === transitionPlan.length && dated.every(row => transitionPlan.some(t => t.atUtc === row.effectiveUtc && revisionFingerprint(t.setup) === revisionFingerprint(row.after.setup)));
  const checkpointRef = parent.collection('careWaterCheckpoints').doc('latest');
  const saved = (await checkpointRef.get()).data()?.checkpoint as WaterCheckpoint | undefined;
  const input: WaterModelInput = { ...plan, setup: plantSetup(plant), evaluationUtc, events: events.events, checkpoint: saved };
  const output = events.complete && setupMatches ? runWaterModel(input) : { mode: 'shadow' as const, candidate: 'uncertain' as const, states: [], projection: null,
    reasonCodes: [...events.reasonCodes, ...(setupMatches ? [] : ['setup_history_not_reconciled'])] };
  // Freeze the original origin/input, not a new origin derived from the reusable checkpoint.
  const checkpoint = output.states.length ? makeWaterCheckpoint(input, output.states) : null;
  const record = { schemaVersion: 1, mode: 'shadow', inputKey: key, evaluationUtc, input: { ...input, checkpoint: null }, output, checkpoint };
  const serialized = revisionFingerprint(record);
  if (Buffer.byteLength(serialized) > 800000) throw new Error('shadow_snapshot_size_limit');
  const id = createHash('sha256').update(serialized).digest('hex');
  return db.runTransaction(async tx => {
    const [current, previousCheckpoint] = await Promise.all([tx.get(parent), tx.get(checkpointRef)]);
    if (!current.exists || current.data()?.deleting || careInputKey(current.data() as Plant) !== key) return false;
    if ((previousCheckpoint.data()?.evaluationUtc ?? -Infinity) > evaluationUtc) return false;
    tx.set(parent.collection('careShadow').doc(id), JSON.parse(serialized));
    if (checkpoint) tx.set(checkpointRef, JSON.parse(revisionFingerprint({ mode: 'shadow', evaluationUtc, checkpoint })));
    // No care snapshot/pointer is changed. Synthetic/unapproved outputs cannot become user advice.
    return true;
  });
}
