import { presentCareCard } from '../plantCare';
import type { SuggestionCard } from '@/lib/suggestions/types';
const card = { id: 'watering', kind: 'watering', severity: 'critical', title: 'Check whether watering is needed', summary: 'Inspect soil.', reasons: [], confidence: 'low', metrics: {}, active: true, algorithmVersion: 'test' } satisfies SuggestionCard;
it('presents uncertain watering as a check and keeps confirmed risks urgent', () => {
  expect(presentCareCard(card, false, false)).toMatchObject({ severity: 'watch', title: 'Check soil moisture' });
  expect(presentCareCard({ ...card, kind: 'powderyMildew' } as SuggestionCard, false, false).severity).toBe('critical');
  // Recording water annotates care; it cannot supply moisture evidence or increase confidence.
  expect(presentCareCard(card, true, false)).toMatchObject({ severity: 'watch', title: 'Check soil moisture', confidence: 'low' });
  expect(presentCareCard({ ...card, metrics: { needsWater: true } }, true, false).metrics.needsWater).toBe(true);
  expect(card.severity).toBe('critical');
});
it('expired local experiments request recalculation on the device', () => {
  const expired = presentCareCard({ ...card, algorithmVersion: 'hops-8.4.0', metrics: { needsWater: true, experimental: true, expiresAtUtc: 1 } }, false, false, new Date(2000));
  expect(expired.title).toBe('Local test: refresh needed');
  expect(expired.summary).toContain('on this device'); expect(expired.metrics.needsWater).toBeNull();
});
