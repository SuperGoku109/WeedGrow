export type EditBaseline = Record<string, unknown>;
function plain(value: any): any {
  if (value?.toMillis) return value.toMillis();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, plain(value[key])]));
  return value ?? null;
}
// Compare only edited fields: a new photo or weather update must not block a name edit.
export function assertUnchanged(current: Record<string, any>, updates: Record<string, any>, baseline?: EditBaseline) {
  if (!baseline) return;
  const keys = new Set(Object.keys(updates));
  if (keys.has('location') || keys.has('locationMode') || keys.has('environment')) { keys.add('groupId'); keys.add('location'); keys.add('locationMode'); }
  if ([...keys].some(key => JSON.stringify(plain(current[key])) !== JSON.stringify(plain(baseline[key])))) {
    throw new Error('These details changed in another tab or device. Your edits are kept. Close and reopen this editor to review the latest details before saving.');
  }
}
