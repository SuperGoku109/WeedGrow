import { collection, getDocs, limit, query, writeBatch, type Firestore } from 'firebase/firestore';
/** Re-read the first page after each committed delete. This bounds memory and
 * safely resumes after an interruption without a cursor over deleted records.
 * The caller must first prevent new writes (the plant deletion tombstone). */
export async function deleteCollectionInBatches(db: Firestore, path: string, pageSize = 50) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 450) throw new Error('Choose a cleanup batch size between 1 and 450.');
  const ref = collection(db, path);
  while (true) {
    const page = await getDocs(query(ref, limit(pageSize)));
    if (page.empty) return;
    const batch = writeBatch(db);
    page.docs.forEach(item => batch.delete(item.ref));
    await batch.commit();
  }
}
