import React from 'react';
// @ts-expect-error Expo includes the renderer without declarations.
import { act, create } from 'react-test-renderer';
import { useJournalDay } from '../hooks/useJournalDay';
let current!: ReturnType<typeof useJournalDay>;
function Probe({ id = 'one', zone = 'Africa/Johannesburg', now = '2026-10-26T12:00:00Z', addedOn }: { id?: string; zone?: string; now?: string; addedOn?: string }) { current = useJournalDay(id, zone, new Date(now), addedOn); return null; }
let renderer: any;
afterEach(() => act(() => renderer?.unmount()));
it('follows the plant day across midnight until a historical day is explicitly selected', () => {
  act(() => { renderer = create(React.createElement(Probe)); }); expect(current.selected).toBe('2026-10-26');
  act(() => renderer.update(React.createElement(Probe, { now: '2026-10-27T12:00:00Z' }))); expect(current.selected).toBe('2026-10-27');
  act(() => current.select('2026-10-20'));
  act(() => renderer.update(React.createElement(Probe, { now: '2026-10-28T12:00:00Z' }))); expect(current.selected).toBe('2026-10-20');
  act(() => current.backToToday()); expect(current.selected).toBe('2026-10-28');
});
it('masks another plant’s selection immediately and resolves today in the location time zone', () => {
  act(() => { renderer = create(React.createElement(Probe, { zone: 'America/Los_Angeles', now: '2026-10-26T00:30:00Z' })); }); expect(current.today).toBe('2026-10-25');
  act(() => current.jump('2026-10-10'));
  act(() => renderer.update(React.createElement(Probe, { id: 'two', zone: 'Asia/Tokyo', now: '2026-10-26T00:30:00Z' }))); expect(current.selected).toBe('2026-10-26');
});
it('keeps the visible strip stable for a nearby selection and recenters calendar jumps', () => {
  act(() => { renderer = create(React.createElement(Probe)); }); const initial = current.dates;
  act(() => current.select('2026-10-25')); expect(current.dates).toEqual(initial);
  act(() => current.jump('2026-03-29')); expect(current.dates[6]).toBe('2026-03-29');
  act(() => current.moveWeek(1)); expect(current.selected).toBe('2026-04-05'); expect(current.dates).toHaveLength(7);
  act(() => current.moveWeek(-1)); expect(current.selected).toBe('2026-03-29');
});
it('ignores impossible dates and keeps a just-saved historical day fixed when the clock catches up', () => {
  act(() => { renderer = create(React.createElement(Probe)); });
  act(() => current.jump('2026-02-31')); expect(current.selected).toBe('2026-10-26');
  act(() => current.select('2026-10-26', '2026-10-27'));
  act(() => renderer.update(React.createElement(Probe, { now: '2026-10-27T12:00:00Z' }))); expect(current.selected).toBe('2026-10-26'); expect(current.isToday).toBe(false);
});
it('limits all selection paths and the visible row to the plant added day', () => {
  act(() => { renderer = create(React.createElement(Probe, { addedOn: '2026-10-23' })); });
  expect(current.dates).toHaveLength(7); expect(current.dates[0]).toBe('2026-10-23');
  expect(current.canGoBack).toBe(false);
  act(() => current.select('2026-10-22')); expect(current.selected).toBe('2026-10-26');
  act(() => current.jump('2025-01-01')); expect(current.selected).toBe('2026-10-26');
  act(() => current.moveWeek(-1)); expect(current.selected).toBe('2026-10-23');
  expect(current.dates[0]).toBe('2026-10-23');
  act(() => current.select('2026-10-23')); expect(current.selected).toBe('2026-10-23');
});
it('clamps existing selection when the added date becomes available after loading', () => {
  act(() => { renderer = create(React.createElement(Probe)); });
  act(() => current.jump('2020-01-01'));
  act(() => renderer.update(React.createElement(Probe, { addedOn: '2026-10-17' })));
  expect(current.selected).toBe('2026-10-17'); expect(current.dates[0]).toBe('2026-10-17');
});
