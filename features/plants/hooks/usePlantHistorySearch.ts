import { useEffect, useState } from 'react';
import { fetchJournalPage, type JournalCursor } from '@/lib/logs/journalQueries';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { useSession } from '@/services/session';

// Load the entire chosen date range. Filters never silently cover just one page.
export function usePlantHistorySearch(plantId: string, start: string, end: string, timeZone?: string | null) {
  const { user } = useSession();
  const uid = user?.uid;
  const [revision, setRevision] = useState(0);
  const scope = JSON.stringify([user?.uid, plantId, start, end, timeZone, revision]);
  const [result, setResult] = useState<{ scope: string; entries: JournalEntry[]; busy: boolean; error: string }>({ scope: '', entries: [], busy: true, error: '' });
  useEffect(() => {
    let active = true;
    if (!uid) { setResult({ scope, entries: [], busy: false, error: 'Sign in to search your journal.' }); return; }
    setResult({ scope, entries: [], busy: true, error: '' });
    const load = async () => {
      const entries = new Map<string, JournalEntry>();
      let cursor: JournalCursor | undefined;
      try {
        do {
          const page = await fetchJournalPage(plantId, start, end, 50, cursor, timeZone);
          if (!active) return;
          page.entries.forEach(entry => entries.set(entry.id, entry));
          setResult({ scope, entries: [...entries.values()], busy: page.hasMore, error: '' });
          if (!page.hasMore) return;
          if (!page.cursor || page.cursor.id === cursor?.id) throw new Error('History could not be fully loaded. Retry this range.');
          cursor = page.cursor;
        } while (active);
      } catch (failure) { if (active) setResult({ scope, entries: [...entries.values()], busy: false, error: failure instanceof Error ? failure.message : 'Could not load history. Retry.' }); }
    };
    void load();
    return () => { active = false; };
  }, [scope, plantId, start, end, timeZone, uid]);
  return { ...(result.scope === scope ? result : { entries: [], busy: true, error: '' }), retry: () => setRevision(value => value + 1) };
}
