import { activeSourceEvents, type SourceEvent } from '../sourceEvents';
const event: SourceEvent = { issuer: 'test', product: 'test', id: 'event', revision: 1, sourceRevision: 'r1', locationRevision: 1,
  availableUtc: 100, startUtc: 100, endUtc: 200, hazard: 'hail', severity: 'source-severe', cancelled: false };
test('retries deduplicate; latest cancellation removes an event even when replayed out of order', () => {
  expect(activeSourceEvents([event, event], 150, 1).active).toHaveLength(1);
  expect(activeSourceEvents([{ ...event, cancelled: true, revision: 2, sourceRevision: 'r2' }, event], 150, 1).active).toEqual([]);
});
test('unresolved final conflict is unknown; later correction clears it', () => {
  const conflict = { ...event, cancelled: true };
  expect(activeSourceEvents([event, conflict], 150, 1).issues).toContain('source_event_revision_conflict');
  expect(activeSourceEvents([event, conflict, { ...event, revision: 2 }], 150, 1).issues).toEqual([]);
});
test('location, availability and validity scopes prevent stale or future alerts', () => {
  expect(activeSourceEvents([event], 150, 2).active).toEqual([]);
  expect(activeSourceEvents([event], 99, 1).active).toEqual([]);
  expect(activeSourceEvents([event], 200, 1).active).toEqual([]);
});
