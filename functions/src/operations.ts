import { getFirestore, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { parseWeatherMeasurements } from '../../lib/weather/weatherMeasurements';
import { plantDay } from '../../lib/dates/plantDay';
import { refreshPlantCare, readCareConfiguration, careConfigurationKey } from './careOperations';
import { revisionFingerprint } from '../../lib/careAlgorithm/revisions';

const db = () => getFirestore();
const point = (p: unknown): p is { lat: number; lng: number } => !!p && typeof p === 'object' && 'lat' in p && 'lng' in p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
const same = (a: unknown, b: unknown) => point(a) && point(b) && a.lat === b.lat && a.lng === b.lng;
function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(compact);
  if (value && typeof value === 'object' && !(value instanceof Timestamp)) return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, compact(v)]));
  return value;
}
/** Re-read authoritative logs in the transaction: duplicate/out-of-order events are harmless. */
export async function rebuildCareSummary(id: string) {
  const ref = db().doc(`plants/${id}`);
  await db().runTransaction(async tx => {
    const plant = await tx.get(ref);
    if (!plant.exists || plant.data()?.deleting) return;
    const summary: Record<string, unknown> = { version: 1, revision: plant.data()?.careRevision || 0 };
    for (const type of ['watering', 'fertilizing']) {
      const latest = await tx.get(ref.collection('logs').where('type', '==', type).orderBy('timestamp', 'desc').limit(1));
      const log = latest.docs[0]; const data = log?.data();
      summary[type] = data ? compact({ id: log.id, timestamp: data.timestamp, mutationId: data.mutationId, calendarDay: data.calendarDay, timeZone: data.timeZone }) : null;
    }
    if (revisionFingerprint(plant.data()?.careSummary) !== revisionFingerprint(summary)) tx.update(ref, { careSummary: summary });
  });
}
export async function collectGardenWeather(id: string, key: string, request: typeof fetch = fetch) {
  const ref = db().doc(`groups/${id}`); const first = await ref.get(); const garden = first.data();
  if (!garden || garden.deleting || !point(garden.location)) return false;
  const pin = garden.location; const cached = garden.currentWeather;
  const age = Date.now() - (cached?.fetchedAt?.toMillis?.() || 0);
  if (same(cached?.sourceCoordinates, pin) && cached?.date === plantDay(new Date(), cached.timeZone) && age >= 0 && age < 6 * 3600000) return false;
  const response = await request(`https://api.openweathermap.org/data/3.0/onecall?lat=${pin.lat}&lon=${pin.lng}&exclude=minutely,alerts&units=metric&appid=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`weather-${response.status}`);
  const raw = await response.json();
  const parsed = parseWeatherMeasurements({ ...raw, _weedgrowFetchedAt: Date.now() });
  const observed = Object.values(parsed).find(v => !v.forecasted);
  if (!observed) throw new Error('weather-incomplete');
  const today = plantDay(new Date(), observed.timeZone);
  const entries = Object.entries(parsed).filter(([day]) => day >= today);
  await db().runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (!current || current.deleting || !same(current.location, pin)) return;
    const refs = entries.map(([day]) => ref.collection('weatherCache').doc(day));
    const previous = await Promise.all(refs.map(r => tx.get(r)));
    let live: unknown;
    entries.forEach(([day, { fetchedAtMillis, ...data }], index) => {
      const old = previous[index].data();
      if ((old?.fetchedAt?.toMillis?.() || 0) > fetchedAtMillis) { if (day === today) live = old; return; }
      const history = [...(old?.previousLocations || [])];
      if (old && day === today && !same(old.sourceCoordinates, pin)) { const { previousLocations: _prior, ...prior } = old; history.push(prior); }
      const entry = compact({ ...data, fetchedAt: Timestamp.fromMillis(fetchedAtMillis), sourceCoordinates: pin, locationLabel: current.locationLabel || '', ...(history.length ? { previousLocations: history } : {}) });
      if (JSON.stringify(entry).length > 800000) throw new Error('weather-history-limit');
      tx.set(refs[index], entry as FirebaseFirestore.DocumentData);
      if (day === today) live = entry;
    });
    if (live) tx.update(ref, { currentWeather: live });
  });
  return true;
}
/** Bounded, resumable maintenance; a lease prevents overlapping scheduled invocations. */
export async function runMaintenance(key: string, request: typeof fetch = fetch) {
  const lease = db().doc('maintenance/gardenCollection'); const token = db().collection('maintenance').doc().id;
  const owned = await db().runTransaction(async tx => {
    const data = (await tx.get(lease)).data();
    if ((data?.until?.toMillis?.() || 0) > Date.now()) return false;
    tx.set(lease, { token, until: Timestamp.fromMillis(Date.now() + 600000) }, { merge: true }); return true;
  });
  if (!owned) return;
  let failures = 0;
  try {
    const state = (await lease.get()).data();
    let gardens = db().collection('groups').orderBy(FieldPath.documentId()).limit(100);
    if (state?.gardenCursor) gardens = gardens.startAfter(state.gardenCursor);
    const page = await gardens.get();
    let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => { while (next < page.size) { const garden = page.docs[next++]; try { await collectGardenWeather(garden.id, key, request); } catch { failures++; } } }));
    const cursor = page.size === 100 ? page.docs.at(-1)!.id : null;
    const configuration = await readCareConfiguration();
    const configKey = careConfigurationKey(configuration);
    const now = Date.now() / 1000;
    // Timers only load plants whose existing decision expires. A bounded daily
    // reconciliation also discovers legacy plants and missed triggers. Policy
    // changes restart that reconciliation immediately, without rewriting every
    // plant merely to mark it due.
    const reset = state?.careQueueVersion !== 1 || state?.careConfigKey !== configKey
      || state?.careRepairDay !== Math.floor(now / 86400);
    let repairCursor: string | null = reset ? null : state?.careRepairCursor ?? null;
    let repairComplete = reset ? false : state?.careRepairComplete === true;
    const due = await db().collection('plants').where('status', '==', 'active')
      .where('careNextEvaluationUtc', '<=', now).orderBy('careNextEvaluationUtc').limit(repairComplete ? 100 : 75).get();
    const repairLimit = 100 - due.size;
    let repair: FirebaseFirestore.QuerySnapshot | undefined;
    if (!repairComplete) {
      let query = db().collection('plants').where('status', '==', 'active').orderBy(FieldPath.documentId()).limit(repairLimit);
      if (repairCursor) query = query.startAfter(repairCursor);
      repair = await query.get();
    }
    const selected = new Map([...due.docs, ...(repair?.docs ?? [])].map(plant => [plant.id, plant]));
    const reconciling = new Set(repair?.docs.map(plant => plant.id) ?? []);
    for (const plant of selected.values()) if (!plant.data().deleting && plant.data().status === 'active') {
      try {
        if (plant.data().careSummary?.version !== 1) await rebuildCareSummary(plant.id);
        await refreshPlantCare(plant.id, key, request, () => Date.now() / 1000,
          { ...configuration, useVerifiedLedgerCache: !reconciling.has(plant.id) });
      } catch {
        failures++;
        // Keep failed legacy work in the due queue so advancing the repair
        // cursor cannot hide it. A deleted parent is never recreated.
        await plant.ref.update({ careNextEvaluationUtc: now + 900 }).catch(() => {});
      }
    }
    if (repair) { repairComplete = repair.size < repairLimit; repairCursor = repairComplete ? null : repair.docs.at(-1)!.id; }
    await lease.set({ gardenCursor: cursor, careQueueVersion: 1, careConfigKey: configKey,
      careRepairDay: Math.floor(now / 86400), careRepairCursor: repairCursor, careRepairComplete: repairComplete,
      lastRunAt: Timestamp.now(), failures }, { merge: true });
  } finally {
    await db().runTransaction(async tx => { if ((await tx.get(lease)).data()?.token === token) tx.update(lease, { until: Timestamp.fromMillis(0) }); });
  }
  if (failures) throw new Error('Some gardens could not refresh; inspect maintenance/gardenCollection.');
}
