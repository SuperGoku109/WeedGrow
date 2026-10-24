const formatters = new Map<string, Intl.DateTimeFormat>();
export function isCalendarDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}
function formatter(timeZone: string, mode: 'day' | 'time') {
  const key = `${mode}:${timeZone}`; const existing = formatters.get(key); if (existing) return existing;
  const value = new Intl.DateTimeFormat(mode === 'day' ? 'en-CA' : 'en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', ...(mode === 'time' ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } as const : {}) });
  formatters.set(key, value); if (formatters.size > 32) formatters.delete(formatters.keys().next().value!);
  return value;
}
// Calendar days belong to the plant's location, rather than the viewing device.
export function plantDay(date = new Date(), timeZone?: string | null): string {
  if (timeZone) {
    try {
      const parts = formatter(timeZone, 'day').formatToParts(date);
      const value = (key: string) => parts.find(part => part.type === key)!.value;
      return `${value('year')}-${value('month')}-${value('day')}`;
    } catch { /* Legacy records use the device zone until weather resolves it. */ }
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(day: string, count: number) {
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function zonedTime(day: string, time: string, timeZone?: string | null) {
  if (!timeZone) return new Date(`${day}T${time}:00`);
  let display: Intl.DateTimeFormat;
  try { display = formatter(timeZone, 'time'); } catch { return new Date(`${day}T${time}:00`); }
  const target = Date.parse(`${day}T${time}:00Z`);
  let result = target;
  // Resolve the zone offset at the requested date, including daylight saving.
  for (let i = 0; i < 3; i++) {
    const parts = display.formatToParts(new Date(result));
    const get = (key: string) => parts.find(part => part.type === key)!.value;
    const represented = Date.parse(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`);
    const next = result + target - represented;
    if (next === result) break; result = next;
  }
  return new Date(result);
}
