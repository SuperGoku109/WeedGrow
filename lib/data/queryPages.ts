import { documentId, getDocs, limit, orderBy, query, startAfter, type DocumentData, type Query, type QueryDocumentSnapshot } from 'firebase/firestore';
export const DATA_PAGE_SIZE = 50;
/** Read one bounded page at a time. Document-ID ordering also works for legacy
 * records without timestamps; callers may process/release each page in turn. */
export async function* queryPages(base: Query<DocumentData>, pageSize = DATA_PAGE_SIZE, assertActive: () => void = () => {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid data page size.');
  let cursor: QueryDocumentSnapshot | undefined;
  while (true) {
    assertActive();
    const snapshot = await getDocs(query(base, orderBy(documentId()), limit(pageSize), ...(cursor ? [startAfter(cursor)] : [])));
    assertActive();
    if (snapshot.metadata?.fromCache) throw new Error('Connect to load a complete copy of your garden, then retry.');
    if (!snapshot.docs.length) return;
    yield snapshot.docs;
    if (snapshot.docs.length < pageSize) return;
    const next = snapshot.docs.at(-1)!;
    if (cursor?.id === next.id) throw new Error('Data paging did not advance. Retry this operation.');
    cursor = next;
  }
}
