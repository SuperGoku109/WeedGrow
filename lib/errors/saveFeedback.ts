/** Preserve validation/conflict errors; translate only known transport failures. */
export function saveErrorMessage(error: unknown, fallback = 'Could not save. Try again.') {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code).split('/').pop() || '' : '';
  if (['unavailable', 'deadline-exceeded', 'network-request-failed'].includes(code)) return 'Connection interrupted. Your entries are still on this screen. Check your connection and try again.';
  return error instanceof Error ? error.message : fallback;
}
