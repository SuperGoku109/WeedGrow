import { calculatePlantWatering } from '../wateringEngine';
import { createRangeWindow, makePlantSummary, makeWeatherEntry, toDateKey } from './fixtures';
it('calculates from explicit inputs without mutating them or depending on wall-clock time', () => {
  const today = new Date(2026, 1, 10);
  const range = createRangeWindow(today);
  range[toDateKey(today)].weather = makeWeatherEntry(toDateKey(today));
  const plant = makePlantSummary();
  const before = JSON.stringify({ plant, range });
  const options = { lookbackDays: 6, rainfallThresholdMm: 8 };
  const first = calculatePlantWatering(plant, today, options, range);
  jest.useFakeTimers().setSystemTime(new Date('2035-01-01T00:00:00Z'));
  try { expect(calculatePlantWatering(plant, today, options, range)).toEqual(first); }
  finally { jest.useRealTimers(); }
  expect(JSON.stringify({ plant, range })).toBe(before);
});
