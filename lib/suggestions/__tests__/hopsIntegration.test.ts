import { calculatePlantWatering } from '../wateringEngine';
import { buildSuggestionCardsFromInsight } from '../suggestionCards';
import { presentCareCard } from '@/features/plants/plantCare';
import { adviceInput } from '../adviceInputs';
import { makePlantSummary, createRangeWindow } from './fixtures';
import { evaluatePowderyMildewAlgorithm } from '../algorithms/powderyMildewAlgorithm';
jest.mock('../wateringSuggestions', () => ({ evaluateWateringInsights: jest.fn() }));

test('production app path preserves null without legacy drying/disease scores or repeated moisture prompts', () => {
  const now = new Date('2026-11-05T12:34:56Z'); const plant = makePlantSummary();
  const insight = calculatePlantWatering(plant, now, { lookbackDays: 6, rainfallThresholdMm: 8 }, createRangeWindow(now))!;
  expect(insight.needsWater).toBeNull(); expect(insight.careEvaluation!.evaluationUtc).toBe(now.getTime() / 1000);
  expect(insight.mildewRiskLevel).toBe('unknown');
  expect(evaluatePowderyMildewAlgorithm({ insight, now })).toMatchObject({ active: false, title: 'Powdery mildew assessment unavailable', confidence: 'low' });
  const cards = buildSuggestionCardsFromInsight(insight, now);
  expect(cards).toHaveLength(1); expect(cards[0].metrics.needsWater).toBeNull();
  expect(cards[0].title).toBe('Watering estimate unavailable');
  expect(cards[0].summary).not.toMatch(/check.*soil|root rot|mildew risk/i);
  expect(presentCareCard(cards[0], true, false)).toMatchObject({ confidence: 'low', metrics: { needsWater: null } });
});
test('watering recorded cannot erase due or raise confidence; stale supported decisions expire to unknown', () => {
  const card = { id: 'test', kind: 'watering' as const, active: true, title: 'Estimated watering due', summary: 'Test',
    reasons: [], confidence: 'high' as const, severity: 'warn' as const, metrics: { needsWater: true }, algorithmVersion: 'hops-8.4.0' };
  expect(presentCareCard(card, true, false)).toMatchObject({ metrics: { needsWater: true }, severity: 'warn' });
  expect(presentCareCard(card, true, true)).toMatchObject({ metrics: { needsWater: null }, confidence: 'low' });
  const expired = presentCareCard({ ...card, summary: 'Water immediately.', reasons: ['Water now.'] }, true, true);
  expect(expired.summary).not.toMatch(/water immediately/i); expect(expired.reasons).toEqual([]);
  expect(card.metrics.needsWater).toBe(true);
});
test('deleted/inactive plants do not receive algorithm care', () => {
  const now = new Date();
  expect(calculatePlantWatering(makePlantSummary({ deleting: true }), now, { lookbackDays: 6, rainfallThresholdMm: 8 }, {})).toBeNull();
});
test('used root-zone/reception changes invalidate app advice dependencies', () => {
  const plant = makePlantSummary();
  expect(adviceInput({ ...plant, plantedIn: 'ground' })).not.toEqual(adviceInput(plant));
  expect(adviceInput({ ...plant, rainReception: { soil: 'no', canopy: 'no' } })).not.toEqual(adviceInput(plant));
});
