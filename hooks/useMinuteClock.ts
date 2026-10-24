import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
let now = new Date();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let resume: ReturnType<typeof AppState.addEventListener> | undefined;
const tick = () => { now = new Date(); listeners.forEach(notify => notify()); };
function subscribe(notify: () => void) {
  listeners.add(notify);
  if (!timer) { tick(); timer = setInterval(tick, 60000); resume = AppState.addEventListener('change', state => { if (state === 'active') tick(); }); }
  return () => { listeners.delete(notify); if (!listeners.size) { clearInterval(timer); timer = undefined; resume?.remove(); resume = undefined; } };
}
const get = () => now;
export function useMinuteClock() { return useSyncExternalStore(subscribe, get, get); }
