import { evaluateWateringInsights } from '../wateringSuggestions';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { makePlantSummary, createRangeWindow, makeWeatherEntry, toDateKey, makeLog, addRangeLog } from './fixtures';
jest.mock('@/lib/logs/fetchLogsAndWeatherForRange', () => ({ fetchLogsAndWeatherForRange: jest.fn() }));
jest.mock('@/lib/weather/fetchWeather', () => ({ fetchWeather: jest.fn() }));
jest.mock('@/lib/weather/updateFirestore', () => ({ updateWeatherCache: jest.fn() }));
jest.mock('@/lib/weather/parseWeatherData', () => ({ parseWeatherData: jest.fn() }));
jest.mock('@/lib/logger', () => ({ __esModule: true, default: { error: jest.fn() } }));
beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-11-05T12:34:56Z')));
afterEach(() => jest.useRealTimers());
test('real asynchronous production route stays unknown through a weather outage', async () => {
  jest.mocked(fetchLogsAndWeatherForRange).mockResolvedValue({});
  jest.mocked(fetchWeather).mockRejectedValue(new Error('outage'));
  const result = await evaluateWateringInsights([makePlantSummary()]);
  expect(result).toHaveLength(1); expect(result[0].needsWater).toBeNull();
  expect(result[0].careEvaluation!.evaluationUtc).toBe(Date.now() / 1000);
  expect(result[0].reason).not.toMatch(/check.*soil/i);
});
test('daily rain, hot weather and watering logs cannot activate an unapproved hops profile', async () => {
  const now = new Date(); const key = toDateKey(now); const range = createRangeWindow(now);
  range[key].weather = makeWeatherEntry(key, { temperature: 40, humidity: 95, rainfall: 50, forecasted: true });
  addRangeLog(range, key, makeLog(now, 'watering'));
  jest.mocked(fetchLogsAndWeatherForRange).mockResolvedValue(range);
  jest.mocked(fetchWeather).mockRejectedValue(new Error('outage'));
  const result = await evaluateWateringInsights([makePlantSummary()]);
  expect(result[0].needsWater).toBeNull(); expect(result[0].mildewShouldWarn).toBe(false);
  expect(result[0].careEvaluation!.warnings.find(w => w.id === 'W10')!.state).toBe('disabled');
});
test('deleting plants never receive care', async () => {
  expect(await evaluateWateringInsights([makePlantSummary({ deleting: true })])).toEqual([]);
});
test('invalid coordinates never start weather requests', async () => {
  jest.mocked(fetchLogsAndWeatherForRange).mockResolvedValue({});
  await evaluateWateringInsights([makePlantSummary({ location: { lat: Infinity, lng: 190 } })]);
  expect(fetchWeather).not.toHaveBeenCalled();
});
test('history read failure retains an unavailable care result instead of silently dropping the plant', async () => {
  jest.mocked(fetchLogsAndWeatherForRange).mockRejectedValue(new Error('offline'));
  const [insight] = await evaluateWateringInsights([makePlantSummary()]);
  expect(insight.needsWater).toBeNull(); expect(insight.careEvaluation!.water.decision).toBe('uncertain');
});
test('history queries use the plant calendar day when it differs from the device day', async () => {
  jest.setSystemTime(new Date('2026-11-05T23:30:00Z'));
  jest.mocked(fetchLogsAndWeatherForRange).mockResolvedValue({});
  jest.mocked(fetchWeather).mockRejectedValue(new Error('offline'));
  await evaluateWateringInsights([makePlantSummary({ locationTimeZone: 'Pacific/Auckland' })]);
  expect(jest.mocked(fetchLogsAndWeatherForRange).mock.calls[0]).toEqual(['plant-1', '2026-10-31', '2026-11-07', 'Pacific/Auckland']);
});
