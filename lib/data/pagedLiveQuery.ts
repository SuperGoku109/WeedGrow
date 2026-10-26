import { documentId, limit, onSnapshot, orderBy, query, startAfter, type DocumentData, type Query, type QueryDocumentSnapshot } from 'firebase/firestore';
export class DataLimitError extends Error { constructor() { super('This garden exceeds the supported limit of 5,000 records per collection. Export or split the collection before continuing.'); this.name = 'DataLimitError'; } }
/** Ordered live pages publish only complete inventories. A changed boundary
 * invalidates following pages before reopening them, preventing gaps/duplicates
 * after an insertion or deletion. Ordinary field edits keep other pages alive. */
export function listenPagedQuery<T>(base: Query<DocumentData>, decode: (item: QueryDocumentSnapshot) => T, next: (items: T[]) => void, fail: (reason?: unknown) => void, pageSize = 100, maxRecords = 5000) {
  type Page = { items: T[]; ready: boolean; cursorId: string; terminal: boolean; stop?: () => void };
  const pages = new Map<number, Page>(); let active = true;
  const discardAfter = (index: number) => { for (const [number, page] of pages) if (number > index) { pages.delete(number); page.stop?.(); } };
  const publish = () => {
    const items: T[] = [];
    for (let index = 0; ; index++) { const page = pages.get(index); if (!page?.ready) return; items.push(...page.items); if (page.terminal) { next(items); return; } }
  };
  const open = (index: number, cursor?: QueryDocumentSnapshot) => {
    const page: Page = { items: [], ready: false, cursorId: '', terminal: false }; pages.set(index, page);
    // A detail read may have cached only one plant. A cache-only query cannot
    // establish that an inventory is complete; metadata events confirm the
    // server result even when its documents happen to match the cached ones.
    const deadline = setTimeout(() => { if (active && pages.get(index) === page && !page.ready) fail(new Error('Reconnect to load the complete garden.')); }, 15000);
    const unsubscribe = onSnapshot(query(base, orderBy(documentId()), limit(pageSize), ...(cursor ? [startAfter(cursor)] : [])), { includeMetadataChanges: true }, snapshot => {
      if (!active || pages.get(index) !== page) return;
      if (snapshot.metadata.fromCache) return;
      clearTimeout(deadline);
      try {
        if (index * pageSize + snapshot.docs.length > maxRecords) throw new DataLimitError();
        const items = snapshot.docs.map(decode); const last = snapshot.docs.at(-1); const cursorId = last?.id || '';
        const terminal = snapshot.docs.length < pageSize;
        if (cursorId !== page.cursorId || terminal !== page.terminal) discardAfter(index);
        page.items = items; page.ready = true; page.cursorId = cursorId; page.terminal = terminal;
        if (!terminal && !pages.has(index + 1)) open(index + 1, last);
        publish();
      } catch (error) { page.ready = false; fail(error); }
    }, error => { clearTimeout(deadline); if (active && pages.get(index) === page) { page.ready = false; fail(error); } });
    page.stop = () => { clearTimeout(deadline); unsubscribe(); };
  };
  open(0);
  return () => { active = false; for (const page of pages.values()) page.stop?.(); pages.clear(); };
}
