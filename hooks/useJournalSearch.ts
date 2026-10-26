import { useState } from 'react';
import { useSession } from '@/services/session';
import { useAsyncTask } from './useAsyncTask';
import { fetchJournalPage, type JournalCursor } from '@/lib/logs/journalQueries';
import type { JournalEntry } from '@/lib/logs/journalRepository';
import { localDateKey, validateLogDate } from '@/lib/logs/plantJournal';
import { mapConcurrent } from '@/lib/data/mapConcurrent';
export type JournalResult = JournalEntry & { plantId: string; plantName: string };
export function useJournalSearch(plants: readonly { id: string; name: string }[], start: string, end: string, pageSize = 25, enabled = true, today = localDateKey()) {
  const { user } = useSession();
  const scope = JSON.stringify([user?.uid, plants.map(plant => [plant.id, plant.name]), start, end, pageSize, today]);
  const task = useAsyncTask(scope);
  const [result, setResult] = useState<{ scope: string; entries: JournalResult[]; cursors: Record<string, JournalCursor | null> }>({ scope: '', entries: [], cursors: {} });
  const [validation, setValidation] = useState({ scope: '', error: '' });
  const current = result.scope === scope ? result : { entries: [], cursors: {} as Record<string, JournalCursor | null> };
  const search = async (append = false) => {
    if (!enabled || !user) return;
    if ((start && validateLogDate(start, today)) || validateLogDate(end, today) || start > end) { setValidation({ scope, error: 'Choose valid past dates with the start before the end.' }); return; }
    setValidation({ scope, error: '' });
    const outcome = await task.run(async context => {
      const cursors = append ? { ...current.cursors } : {};
      const pages = await mapConcurrent(plants, 4, async plant => {
        if (context.signal.aborted || append && cursors[plant.id] === null) return [];
        const page = await fetchJournalPage(plant.id, start, end, pageSize, append ? cursors[plant.id] || undefined : undefined);
        cursors[plant.id] = page.hasMore ? page.cursor! : null;
        return page.entries.map(entry => ({ ...entry, plantId: plant.id, plantName: plant.name }));
      });
      const entries = [...(append ? current.entries : []), ...pages.flat()];
      return { scope, entries: [...new Map(entries.map(entry => [`${entry.plantId}/${entry.id}`, entry])).values()].sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis()), cursors };
    });
    if (outcome.ok) setResult(outcome.value);
  };
  return { entries: current.entries, more: Object.values(current.cursors).some(Boolean), busy: task.status === 'running', error: validation.scope === scope && validation.error || task.error, searched: result.scope === scope, search };
}
