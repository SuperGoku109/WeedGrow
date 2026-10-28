import { getFirestore, FieldPath, Timestamp } from 'firebase-admin/firestore';
import { parseWeatherMeasurements } from '../../lib/weather/weatherMeasurements';
import { plantDay } from '../../lib/dates/plantDay';

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
    tx.update(ref, { careSummary: summary });
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
export async function runMaintenance(key: string) {
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
    await Promise.all(Array.from({ length: 4 }, async () => { while (next < page.size) { const garden = page.docs[next++]; try { await collectGardenWeather(garden.id, key); } catch { failures++; } } }));
    const cursor = page.size === 100 ? page.docs.at(-1)!.id : null;
    let plants = db().collection('plants').orderBy(FieldPath.documentId()).limit(100);
    if (state?.plantCursor) plants = plants.startAfter(state.plantCursor);
    const legacy = await plants.get();
    for (const plant of legacy.docs) if (plant.data().careSummary?.version !== 1 && !plant.data().deleting) await rebuildCareSummary(plant.id);
    await lease.set({ gardenCursor: cursor, plantCursor: legacy.size === 100 ? legacy.docs.at(-1)!.id : null, lastRunAt: Timestamp.now(), failures }, { merge: true });
  } finally {
    await db().runTransaction(async tx => { if ((await tx.get(lease)).data()?.token === token) tx.update(lease, { until: Timestamp.fromMillis(0) }); });
  }
  if (failures) throw new Error('Some gardens could not refresh; inspect maintenance/gardenCollection.');
}
