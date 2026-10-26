import { useCallback, useMemo, useState } from 'react';
import { addDays, isCalendarDay, plantDay } from '@/lib/dates/plantDay';

/** A null day follows the plant's today across midnight/time-zone changes.
 * An explicitly browsed date stays fixed. Selection is scoped to the plant. */
export function useJournalDay(plantId: string, timeZone: string | null | undefined, now: Date, addedOn?: string) {
  const today = plantDay(now, timeZone);
  const minimum = addedOn && isCalendarDay(addedOn) ? addedOn : undefined;
  const clamp = (value: string) => minimum && value < minimum ? minimum : value;
  const [saved, setSaved] = useState<{ plantId: string; day: string | null; anchor: string | null }>({ plantId, day: null, anchor: null });
  const current = saved.plantId === plantId ? saved : { day: null, anchor: null };
  const selected = clamp(current.day || today);
  const anchor = clamp(current.anchor || selected);
  const dates = useMemo(() => { const start = minimum && addDays(anchor, -6) < minimum ? minimum : addDays(anchor, -6); return Array.from({ length: 7 }, (_, index) => addDays(start, index)); }, [anchor, minimum]);
  const choose = useCallback((day: string, recenter: boolean, referenceToday = today) => {
    if (!isCalendarDay(day) || (minimum && day < minimum)) return;
    setSaved({ plantId, day: day === referenceToday ? null : day, anchor: day === referenceToday ? null : !recenter && dates.includes(day) ? anchor : day });
  }, [plantId, today, dates, anchor, minimum]);
  const select = useCallback((day: string, referenceToday?: string) => choose(day, false, referenceToday), [choose]);
  const jump = useCallback((day: string, referenceToday?: string) => choose(day, true, referenceToday), [choose]);
  const backToToday = useCallback(() => setSaved({ plantId, day: null, anchor: null }), [plantId]);
  const moveWeek = useCallback((direction: number) => choose(minimum && direction < 0 && addDays(anchor, -7) < minimum ? minimum : addDays(anchor, direction < 0 ? -7 : 7), true), [choose, anchor, minimum]);
  return { today, selected, dates, minimum, canGoBack: !minimum || dates[0] > minimum, select, jump, backToToday, moveWeek, isToday: selected === today, isFuture: selected > today };
}
