import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';
let reduced = false; let generation = 0;
const listeners = new Set<() => void>();
let stop: (() => void) | undefined;
const publish = (value: boolean) => { if (reduced !== value) { reduced = value; listeners.forEach(notify => notify()); } };
function subscribe(notify: () => void) {
  listeners.add(notify);
  if (!stop) {
    const request = ++generation;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (request === generation) publish(value); }).catch(() => { if (request === generation) publish(true); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { generation++; publish(value); });
    stop = () => subscription.remove();
  }
  return () => { listeners.delete(notify); if (!listeners.size) { generation++; stop?.(); stop = undefined; } };
}
export function useReducedMotion() { return useSyncExternalStore(subscribe, () => reduced, () => true); }
