export type Diagnostic = { operation: 'handled' | 'save' | 'weather' | 'render' | 'unhandled'; code: string; severity: 'error' | 'fatal' };
const allowed = new Set(['unavailable', 'deadline-exceeded', 'permission-denied', 'unauthenticated', 'network-request-failed', 'resource-exhausted']);
let sink: ((event: Diagnostic) => void) | undefined;
export function setDiagnosticSink(next?: (event: Diagnostic) => void) { sink = next; }
/** No raw error message, stack, plant content, identifiers or coordinates leave the app. */
export function reportError(error: unknown, operation: Diagnostic['operation'] = 'handled', fatal = false) {
  const raw = error && typeof error === 'object' && 'code' in error ? String(error.code).split('/').pop() || '' : '';
  try { sink?.({ operation, code: allowed.has(raw) ? raw : 'unknown', severity: fatal ? 'fatal' : 'error' }); } catch { /* Reporting must never interrupt care or recovery. */ }
}
