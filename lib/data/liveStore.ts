export interface LiveSnapshot<T> { data: T; loading: boolean; error: string }
type Listener<T> = (next: (data: T) => void, fail: () => void) => () => void;
const resets = new Set<() => void>();
export function resetLiveStores() { resets.forEach(reset => reset()); }
export function registerPrivateCacheReset(reset: () => void) { resets.add(reset); return () => { resets.delete(reset); }; }

/** One stream per account/query, shared by mounted consumers. A short grace
 * period bridges navigation transitions; unused streams and data are released. */
export function createLiveStore<T>(empty: T, connect: (key: string) => Listener<T>, errorMessage: string, graceMs = 1500) {
  type Entry = { value: LiveSnapshot<T>; watchers: Set<() => void>; stop?: () => void; timer?: ReturnType<typeof setTimeout>; generation: number };
  const initial: LiveSnapshot<T> = { data: empty, loading: true, error: '' };
  const entries = new Map<string, Entry>();
  const entryFor = (key: string) => {
    let entry = entries.get(key);
    if (!entry) { entry = { value: initial, watchers: new Set(), generation: 0 }; entries.set(key, entry); }
    return entry;
  };
  const publish = (entry: Entry, value: LiveSnapshot<T>) => { entry.value = value; entry.watchers.forEach(notify => notify()); };
  const stop = (entry: Entry) => { entry.generation++; entry.stop?.(); entry.stop = undefined; };
  const start = (key: string, entry: Entry) => {
    stop(entry); const generation = entry.generation;
    publish(entry, { ...entry.value, loading: true, error: '' });
    const fail = () => {
      if (entry.generation === generation) publish(entry, { ...entry.value, loading: false, error: errorMessage });
    };
    try {
      entry.stop = connect(key)(data => {
        if (entry.generation === generation) publish(entry, { data, loading: false, error: '' });
      }, fail);
    } catch { fail(); }
  };
  const clear = () => {
    entries.forEach(entry => { if (entry.timer) clearTimeout(entry.timer); stop(entry); publish(entry, initial); });
    // Active subscribers retain their entry until account-change cleanup runs.
    for (const [key, entry] of entries) if (!entry.watchers.size) entries.delete(key);
  };
  resets.add(clear);
  return {
    initial,
    get: (key: string) => entries.get(key)?.value || initial,
    subscribe(key: string, notify: () => void) {
      const entry = entryFor(key);
      if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined; }
      entry.watchers.add(notify);
      if (!entry.stop) start(key, entry);
      return () => {
        entry.watchers.delete(notify);
        if (!entry.watchers.size) entry.timer = setTimeout(() => {
          if (!entry.watchers.size) { stop(entry); entries.delete(key); }
        }, graceMs);
      };
    },
    refresh(key: string) { const entry = entries.get(key); if (entry?.watchers.size && (!entry.value.loading || !entry.stop)) start(key, entry); },
    retryFailed() { entries.forEach((entry, key) => { if (entry.watchers.size && entry.value.error) start(key, entry); }); },
    clear,
    stats: () => ({ streams: [...entries.values()].filter(entry => !!entry.stop).length, consumers: [...entries.values()].reduce((sum, entry) => sum + entry.watchers.size, 0) }),
  };
}
