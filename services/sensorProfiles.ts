import { decodeProfile } from '@/lib/data/recordDecoders';
import { queryPages } from '@/lib/data/queryPages';
import { DataLimitError } from '@/lib/data/pagedLiveQuery';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, limit, where } from 'firebase/firestore';
import { db } from './firebase';
import { requireUserId } from './session';
export interface SensorProfile { id: string; name: string; environmentType?: 'indoor' | 'greenhouse'; isManual?: boolean; defaultTemp?: number | null; defaultHumidity?: number | null; deleting?: boolean }
export interface ProfileInput { name: string; environmentType: 'indoor' | 'greenhouse'; isManual: boolean; defaultTemp: number | null; defaultHumidity: number | null }
export const createSensorProfileId = () => doc(collection(db, 'sensorProfiles')).id;
export async function listSensorProfiles(): Promise<SensorProfile[]> {
  const uid = requireUserId();
  const profiles: SensorProfile[] = [];
  for await (const page of queryPages(query(collection(db, 'sensorProfiles'), where('createdBy', '==', uid)), 50, () => { if (requireUserId() !== uid) throw new Error('Your account changed.'); })) {
    profiles.push(...page.map(item => decodeProfile(item.data({ serverTimestamps: 'estimate' }), item.id, `sensorProfiles/${item.id}`)));
    if (profiles.length > 5000) throw new DataLimitError();
  }
  return profiles;
}
export async function getSensorProfile(id: string): Promise<SensorProfile | null> {
  const uid = requireUserId(); const snapshot = await getDoc(doc(db, 'sensorProfiles', id));
  if (!snapshot.exists()) return null;
  if (snapshot.data().createdBy !== uid) throw new Error('This profile is not in your account.');
  return decodeProfile(snapshot.data({ serverTimestamps: 'estimate' }), snapshot.id, `sensorProfiles/${id}`);
}
export async function saveSensorProfile(id: string, input: ProfileInput, create = false) {
  const uid = requireUserId();
  if (!input.name.trim() || input.name.trim().length > 100) throw new Error('Use a profile name of 1–100 characters.');
  if (!['indoor', 'greenhouse'].includes(input.environmentType)) throw new Error('Choose a valid profile environment.');
  if (input.isManual && ((input.defaultTemp != null && (!Number.isFinite(input.defaultTemp) || input.defaultTemp < -50 || input.defaultTemp > 80)) || (input.defaultHumidity != null && (!Number.isFinite(input.defaultHumidity) || input.defaultHumidity < 0 || input.defaultHumidity > 100)))) throw new Error('Use a temperature between −50 and 80°C and humidity between 0 and 100%, or leave readings empty.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'sensorProfiles', id); const previous = await tx.get(ref);
    if (previous.exists() && previous.data().createdBy !== uid) throw new Error('This profile is not in your account.');
    if (previous.data()?.deleting) throw new Error('This profile is being deleted. Refresh before making changes.');
    if (create && previous.exists()) return; // A response lost after commit must not duplicate or overwrite a profile.
    if (!create && !previous.exists()) throw new Error('This profile no longer exists. Refresh the list.');
    const fields = { ...input, name: input.name.trim(), defaultTemp: input.isManual ? input.defaultTemp : null, defaultHumidity: input.isManual ? input.defaultHumidity : null, updatedAt: serverTimestamp() };
    if (create) tx.set(ref, { ...fields, createdBy: uid, createdAt: serverTimestamp() });
    else tx.update(ref, fields);
  });
}
export async function deleteSensorProfile(id: string) {
  const uid = requireUserId();
  const ref = doc(db, 'sensorProfiles', id);
  const exists = await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref); if (!snapshot.exists()) return false;
    if (snapshot.data().createdBy !== uid) throw new Error('This profile is not in your account.');
    tx.update(ref, { deleting: true }); return true;
  });
  if (!exists) return;
  // Writers read this profile in their own transaction and reject the marker.
  // Mark first, then inspect references: no new link can commit in the gap.
  const references = await Promise.all([
    getDocs(query(collection(db, 'plants'), where('owners', 'array-contains', uid), where('sensorProfileId', '==', id), limit(1))),
    getDocs(query(collection(db, 'groups'), where('createdBy', '==', uid), where('sensorProfileId', '==', id), limit(1))),
  ]);
  if (references.some(snapshot => snapshot.metadata.fromCache)) throw new Error('Connect to finish checking profile links, then retry deletion.');
  if (references.some(snapshot => !snapshot.empty)) {
    await runTransaction(db, async tx => { const snapshot = await tx.get(ref); if (snapshot.exists() && snapshot.data().createdBy === uid) tx.update(ref, { deleting: false }); });
    throw new Error('This profile is still linked to plants or growing spaces. Remove those links before deleting it.');
  }
  await runTransaction(db, async tx => { const snapshot = await tx.get(ref); if (!snapshot.exists()) return; if (snapshot.data().createdBy !== uid || !snapshot.data().deleting) throw new Error('This profile changed. Refresh and retry.'); tx.delete(ref); });
}
export async function linkedProfilePlants(id: string): Promise<{ name?: string }[]> {
  const uid = requireUserId(); const results: { name: string }[] = [];
  for await (const page of queryPages(query(collection(db, 'plants'), where('owners', 'array-contains', uid), where('sensorProfileId', '==', id)), 50, () => { if (requireUserId() !== uid) throw new Error('Your account changed.'); })) {
    results.push(...page.map(item => { const name: unknown = item.data().name; if (typeof name !== 'string') throw new Error('A linked plant has an invalid name.'); return { name }; }));
    if (results.length > 5000) throw new DataLimitError();
  }
  return results;
}
