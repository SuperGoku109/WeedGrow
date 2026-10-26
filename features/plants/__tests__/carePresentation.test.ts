import { presentCareCard } from '../plantCare';
import type { SuggestionCard } from '@/lib/suggestions/types';
const card = { id: 'watering', kind: 'watering', severity: 'critical', title: 'Check whether watering is needed', summary: 'Inspect soil.', reasons: [], confidence: 'low', metrics: {}, active: true, algorithmVersion: 'test' } satisfies SuggestionCard;
it('presents uncertain watering as a check and keeps confirmed risks urgent', () => {
  expect(presentCareCard(card, false, false)).toMatchObject({ severity: 'watch', title: 'Check soil moisture' });
  expect(presentCareCard({ ...card, kind: 'powderyMildew' } as SuggestionCard, false, false).severity).toBe('critical');
  expect(presentCareCard(card, true, false)).toMatchObject({ severity: 'info', title: 'Watering recorded today' });
  expect(card.severity).toBe('critical');
});
