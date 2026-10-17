import type { SuggestionAlgorithmContext, SuggestionCard } from '@/lib/suggestions/types';

// The weather assessment already combines temperature, humidity, airflow and
// night cycles. Do not add these factors a second time at presentation level.
export function evaluatePowderyMildewAlgorithm({ insight }: SuggestionAlgorithmContext): SuggestionCard {
  const severity = ({ low: 'info', watch: 'watch', high: 'warn', very_high: 'critical' } as const)[insight.mildewRiskLevel];
  const reasons = Array.from(new Set(insight.mildewReasons));
  const mixed = reasons.some(reason => /suppress|lowers|below risk|reduces/i.test(reason));
  const evidence = [insight.humidity, insight.temperatureDay ?? insight.temperatureMax].filter(value => typeof value === 'number' && Number.isFinite(value)).length;
  const confidence = evidence < 2 ? 'low' : mixed || insight.forecastedToday ? 'medium' : 'high';
  return {
    id: insight.plantId + ':powderyMildew',
    kind: 'powderyMildew', active: severity !== 'info', severity,
    title: ({ info: 'Low powdery mildew risk', watch: 'Powdery mildew watch', warn: 'High powdery mildew risk', critical: 'Very high powdery mildew risk' })[severity],
    summary: (mixed ? 'Conditions are mixed: drying or temperature limits offset some humidity risk. ' : '') + 'This is a weather-based risk estimate, not a diagnosis. Inspect leaves for visible symptoms.',
    reasons,
    metrics: { mildewRiskLevel: insight.mildewRiskLevel, humidity: insight.humidity, temperatureDayC: insight.temperatureDay, temperatureMaxC: insight.temperatureMax, consecutiveVeryHumidWarmDays: insight.mildewConsecutiveVeryHumidWarmDays },
    confidence, algorithmVersion: 'powdery-mildew-v2',
  };
}
