import { buildSuggestionCardsFromInsight } from '@/lib/suggestions/suggestionCards';
import type { WateringInsight } from '@/lib/suggestions/wateringSuggestions';
jest.mock('@/lib/weather/parseWeatherData', () => ({ parseWeatherData: jest.fn() }));
jest.mock('@/lib/logs/fetchLogsAndWeatherForRange', () => ({ fetchLogsAndWeatherForRange: jest.fn() }));
jest.mock('@/lib/weather/updateFirestore', () => ({ updateWeatherCache: jest.fn() }));

function makeInsight(overrides: Partial<WateringInsight> = {}): WateringInsight {
  return {
    weatherFetchedAtMs: Date.now(),
    plantId: 'plant-1',
    plantName: 'Test Plant',
    needsWater: false,
    score: 0.5,
    daysSinceLastWater: 1.1,
    thresholdDays: 2.0,
    lastWaterSource: 'manual',
    todayRainfall: 0,
    tomorrowRainfall: 0,
    precipitationProbability: 0.1,
    tomorrowPrecipitationProbability: 0.2,
    forecastedToday: false,
    forecastedTomorrow: true,
    todayRainObserved: true,
    recentRainfallTotalMm: 0,
    hasSaturatingRecentRain: false,
    temperatureMax: 25,
    temperatureMin: 16,
    temperatureDay: 24,
    temperatureNight: 18,
    humidity: 55,
    cloudCoverage: 30,
    dewPoint: 11,
    windSpeed: 8,
    windGust: 12,
    uvIndex: 5,
    weatherSummary: 'clear sky',
    sunrise: '2026-02-15T06:19:53.000Z',
    sunset: '2026-02-15T19:38:25.000Z',
    dayLengthHours: 13.31,
    mildewRiskLevel: 'low',
    mildewShouldWarn: false,
    mildewConsecutiveVeryHumidWarmDays: 0,
    mildewReasons: [],
    reason: 'Watered yesterday; still within watering window.',
    ...overrides,
  };
}

describe('buildSuggestionCardsFromInsight', () => {
  it('returns a watering card when no other risks are active', () => {
    const cards = buildSuggestionCardsFromInsight(makeInsight());
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('watering');
  });

  it('adds mildew card when mildew risk is elevated', () => {
    const cards = buildSuggestionCardsFromInsight(
      makeInsight({
        mildewRiskLevel: 'high',
        mildewShouldWarn: true,
        mildewReasons: ['Humidity near 78%.', 'Temperature 22C is in the favorable mildew range.'],
      }),
    );

    expect(cards.map((card) => card.kind)).toEqual(['powderyMildew', 'watering']);
    const mildewCard = cards.find((card) => card.kind === 'powderyMildew');
    expect(mildewCard?.active).toBe(true);
    expect(mildewCard?.severity).toBe('warn');
  });

  it('adds root rot card when cool wet conditions are present', () => {
    const cards = buildSuggestionCardsFromInsight(
      makeInsight({
        needsWater: false,
        lastWaterSource: 'rain',
        daysSinceLastWater: 0.4,
        todayRainfall: 12,
        tomorrowRainfall: 4,
        humidity: 87,
        temperatureMax: 12,
        reason: 'Still within watering window after recent rain.',
      }),
    );

    expect(cards.some((card) => card.kind === 'rootRot')).toBe(true);
    const rootRotCard = cards.find((card) => card.kind === 'rootRot');
    expect(rootRotCard?.active).toBe(true);
    expect(['warn', 'critical']).toContain(rootRotCard?.severity);
  });

  it('orders cards by severity then by algorithm priority', () => {
    const cards = buildSuggestionCardsFromInsight(
      makeInsight({
        needsWater: true,
        score: 1.1,
        mildewRiskLevel: 'high',
        mildewShouldWarn: true,
        mildewReasons: ['Humidity near 72%.'],
      }),
    );

    expect(cards.map((card) => card.kind)).toEqual(['watering', 'powderyMildew']);
  });

  it('escalates watering severity under extreme drying pressure (UV + gust + long daylight)', () => {
    const cards = buildSuggestionCardsFromInsight(
      makeInsight({
        needsWater: true,
        score: 1.2,
        uvIndex: 12,
        windGust: 38,
        dayLengthHours: 13.8,
      }),
    );
    const wateringCard = cards.find((card) => card.kind === 'watering');
    expect(wateringCard?.severity).toBe('critical');
  });

  it('does not count weather signals twice when presenting an assessed mildew risk', () => {
    const cards = buildSuggestionCardsFromInsight(
      makeInsight({
        mildewRiskLevel: 'watch',
        mildewShouldWarn: false,
        weatherSummary: 'mist',
        tomorrowPrecipitationProbability: 0.8,
        humidity: 72,
        dewPoint: 15,
        temperatureNight: 16,
      }),
    );
    const mildewCard = cards.find((card) => card.kind === 'powderyMildew');
    expect(mildewCard?.severity).toBe('watch');
    expect(mildewCard?.title).toContain('watch');
  });

  it('does not over-trigger root rot from low-confidence forecast rain alone', () => {
    const cards = buildSuggestionCardsFromInsight(
      makeInsight({
        needsWater: false,
        todayRainObserved: false,
        forecastedToday: true,
        todayRainfall: 12,
        precipitationProbability: 0.25,
        tomorrowRainfall: 0,
        humidity: 55,
        temperatureMax: 28,
        weatherSummary: 'clear sky',
      }),
    );
    expect(cards.some((card) => card.kind === 'rootRot')).toBe(false);
  });

  it('suppresses root rot card when strong drying signals offset wet factors', () => {
    const cards = buildSuggestionCardsFromInsight(
      makeInsight({
        needsWater: false,
        todayRainObserved: true,
        todayRainfall: 6,
        humidity: 78,
        temperatureMax: 17,
        cloudCoverage: 85,
        windSpeed: 23,
        windGust: 35,
        uvIndex: 9,
        dayLengthHours: 13.5,
      }),
    );
    const rootRotCard = cards.find((card) => card.kind === 'rootRot');
    expect(rootRotCard).toBeUndefined();
  });
});

it('downgrades stale weather instead of presenting urgent advice with high confidence', () => {
  const now = new Date();
  const cards = buildSuggestionCardsFromInsight(makeInsight({ needsWater: true, score: 2, weatherFetchedAtMs: now.getTime() - 7 * 3600000 }), now);
  const water = cards.find(card => card.kind === 'watering');
  expect(water?.confidence).toBe('low'); expect(water?.severity).toBe('watch'); expect(water?.title).toBe('Check soil moisture');
});
