// Administrative migration only. Never expose this operation in the client app.
// Dry run: node scripts/migrate-legacy-garden.mjs --owner FIREBASE_AUTH_UID
// Apply:   append --apply after checking the dry-run counts and target identity.
import 'dotenv/config';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const args = process.argv.slice(2);
const owner = args[args.indexOf('--owner') + 1];
if (!args.includes('--owner') || !owner || owner.startsWith('--')) throw new Error('Provide the verified account UID with --owner.');
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Set FIREBASE_PROJECT_ID explicitly before running this migration.');
initializeApp({ projectId, credential: applicationDefault() });
const target = await getAuth().getUser(owner);
const db = getFirestore();
const plants = await db.collection('plants').where('owners', 'array-contains', 'demoUser').get();
const groups = await db.collection('groups').where('createdBy', '==', 'demoUser').get();
const profiles = args.includes('--include-unowned-profiles') ? (await db.collection('sensorProfiles').get()).docs.filter(item => !item.data().createdBy || item.data().createdBy === 'demoUser') : [];
console.log(JSON.stringify({ mode: args.includes('--apply') ? 'APPLY' : 'DRY RUN', projectId, targetEmail: target.email || null, owner, plants: plants.size, groups: groups.size, profiles: profiles.length }, null, 2));
if (args.includes('--apply')) {
  const writes = [
    ...plants.docs.map(item => ({ ref: item.ref, data: { owners: [...new Set([...item.data().owners.filter(uid => uid !== 'demoUser'), owner])], ownershipMigratedAt: FieldValue.serverTimestamp() } })),
    ...groups.docs.map(item => ({ ref: item.ref, data: { createdBy: owner } })),
    ...profiles.map(item => ({ ref: item.ref, data: { createdBy: owner } })),
  ];
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + 400)) batch.update(write.ref, write.data);
    await batch.commit();
  }
  console.log('Ownership migrated. Plant contents and dates were preserved. Re-running is safe.');
} else console.log('No records changed. Check the identity and counts before adding --apply. Unowned profiles require --include-unowned-profiles.');
