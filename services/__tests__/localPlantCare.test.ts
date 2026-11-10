import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadLocalCareSettings, saveLocalCareSettings } from '../localCareSettings';
import { readLocalPlantCare } from '../localPlantCare';
import { localCarePreset } from '@/lib/careAlgorithm/localCare';
import { resetLiveStores } from '@/lib/data/liveStore';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import { readCachedWeatherResponse, fetchWeather } from '@/lib/weather/fetchWeather';
import { evaluateWateringInsights } from '@/lib/suggestions/wateringSuggestions';
import { readPlantCareStatus } from '../plantCareEvaluation';
import { makePlantSummary } from '@/lib/suggestions/__tests__/fixtures';
import { decodeCareSnapshot } from '@/lib/careAlgorithm/snapshot';
import { buildSuggestionCardsFromInsight } from '@/lib/suggestions/suggestionCards';
import logger from '@/lib/logger';
import { adviceInput } from '@/lib/suggestions/adviceInputs';
import { meteoFixture } from '@/lib/weather/__tests__/meteoFixture';
import { openMeteoWeatherResponse } from '@/lib/weather/openMeteo';

let mockUid = 'demoUser';
jest.mock('../session', () => ({ requireUserId: () => mockUid }));
jest.mock('../plantCareEvaluation', () => ({ readPlantCareStatus: jest.fn() }));
jest.mock('@/lib/logs/fetchLogsAndWeatherForRange', () => ({ fetchLogsAndWeatherForRange: jest.fn() }));
jest.mock('@/lib/weather/fetchWeather', () => ({ readCachedWeatherResponse: jest.fn(), fetchWeather: jest.fn() }));
jest.mock('@/lib/weather/updateFirestore', () => ({ updateWeatherCache: jest.fn() }));
jest.mock('@/lib/weather/parseWeatherData', () => ({ parseWeatherData: jest.fn() }));
jest.mock('@/lib/logger', () => ({ __esModule: true, default: { error: jest.fn() } }));
const now = new Date('2026-11-09T12:00:00Z');
const plant = makePlantSummary({ potSize: '10 L', rainReception: { soil: 'yes', canopy: 'yes' }, locationTimeZone: 'Africa/Johannesburg' });
beforeEach(async () => {
  mockUid = 'demoUser'; resetLiveStores(); await AsyncStorage.clear();
  jest.useFakeTimers(); jest.setSystemTime(now);
  jest.mocked(fetchLogsAndWeatherForRange).mockResolvedValue({});
  jest.mocked(fetchWeather).mockResolvedValue(openMeteoWeatherResponse(meteoFixture(), Date.now()));
});
afterEach(() => jest.useRealTimers());
test('real interactive path runs the model without backend snapshots, provider requests or weather-cache queries', async () => {
  await saveLocalCareSettings(plant.id, localCarePreset('dry', now.getTime() / 1000));
  const [insight] = await evaluateWateringInsights([JSON.parse(JSON.stringify(adviceInput(plant)))], { execution: 'local' });
  expect(logger.error).not.toHaveBeenCalled();
  expect(insight.needsWater).toBe(true); expect(insight.careDiagnostic?.source).toBe('on_device');
  expect(readPlantCareStatus).not.toHaveBeenCalled(); expect(fetchWeather).not.toHaveBeenCalled();
  expect(readCachedWeatherResponse).toHaveBeenCalledWith(plant.location!.lat, plant.location!.lng);
  expect(fetchLogsAndWeatherForRange).toHaveBeenCalledWith(plant.id, expect.any(String), expect.any(String), plant.locationTimeZone, { logsOnly: true });
  const card = buildSuggestionCardsFromInsight(insight, now).find(c => c.kind === 'watering')!;
  expect(card.title).toBe('Local test: watering due'); expect(card.summary).toContain('assumed ET0/rain');
  expect(card.diagnostics?.some(row => /On-device experiment/.test(row.value))).toBe(true);
  expect(decodeCareSnapshot({ evaluation: insight.careEvaluation }, plant, now.getTime() / 1000)).toBeNull();
});
test('disabled manual or journal-excluded tests avoid all journal queries', async () => {
  await saveLocalCareSettings(plant.id, { ...localCarePreset('dry', now.getTime() / 1000), enabled: false });
  expect((await readLocalPlantCare(plant.id, plant, now)).evaluation?.water.reasonCodes).toContain('local_test_inputs_required');
  expect(fetchLogsAndWeatherForRange).not.toHaveBeenCalled();
  await saveLocalCareSettings(plant.id, { ...localCarePreset('dry', now.getTime() / 1000), includeJournal: false });
  expect((await readLocalPlantCare(plant.id, plant, now)).evaluation?.water.needsWater).toBe(true);
  expect(fetchLogsAndWeatherForRange).not.toHaveBeenCalled();
});
test('no saved test configuration is required for automatic care', async () => {
  const result = await readLocalPlantCare(plant.id, plant, now);
  expect(result.evaluation?.localInputs?.profileMode).toBe('automatic');
  expect(result.evaluation?.profileVersion).toBe('observation-rules-v1');
  expect(result.evaluation?.policyVersion).toBe('outdoor-observation-v1');
  expect(result.evaluation?.outdoor?.recommendations.every(r => r.plantId === plant.id)).toBe(true);
  expect(result.evaluation?.water.reasonCodes).not.toContain('local_test_inputs_required');
  expect(fetchWeather).toHaveBeenCalled(); expect(fetchLogsAndWeatherForRange).toHaveBeenCalled();
});
test('failed journal reads are visible and cannot produce a watering or watering-dependent warning', async () => {
  await saveLocalCareSettings(plant.id, localCarePreset('dry', now.getTime() / 1000));
  jest.mocked(fetchLogsAndWeatherForRange).mockRejectedValueOnce(new Error('offline'));
  const result = await readLocalPlantCare(plant.id, plant, now);
  expect(result.evaluation?.water.needsWater).toBeNull();
  expect(result.evaluation?.water.reasonCodes).toContain('local_journal_read_failed');
  expect(result.evaluation?.warnings.find(w => w.id === 'W06')?.state).toBe('unknown');
  expect(result.diagnostic.journalHistoryReadFailed).toBe(true);
});
test('settings persist across cache reset, are per-account and cannot be used to access another owner’s plant', async () => {
  const chosen = localCarePreset('rainy', now.getTime() / 1000);
  await saveLocalCareSettings(plant.id, chosen); resetLiveStores();
  expect(await loadLocalCareSettings(plant.id)).toEqual(chosen);
  mockUid = 'other';
  expect((await loadLocalCareSettings(plant.id)).enabled).toBe(false);
  await expect(readLocalPlantCare(plant.id, plant, now)).rejects.toThrow('not in your account');
});
test('corrupted saved inputs give a useful local error instead of a missing server result', async () => {
  await AsyncStorage.setItem(`weedgrow.local-care.v1.demoUser.${plant.id}`, '{broken');
  const result = await readLocalPlantCare(plant.id, plant, now);
  expect(result.evaluation?.water.needsWater).toBeNull(); expect(result.evaluation?.water.reasonCodes).toContain('local_test_settings_invalid');
});
test('live mode calculates after provider acquisition, without a false future/stale error', async () => {
  await saveLocalCareSettings(plant.id, { ...localCarePreset('dry', now.getTime() / 1000), weatherMode: 'open-meteo' });
  jest.mocked(fetchWeather).mockImplementationOnce(async () => {
    jest.advanceTimersByTime(1500);
    return openMeteoWeatherResponse(meteoFixture(), Date.now());
  });
  const result = await readLocalPlantCare(plant.id, plant, now);
  expect(result.evaluation?.water.reasonCodes).toContain('open_meteo_model_estimate');
  expect(result.evaluation?.water.reasonCodes).not.toContain('local_meteo_stale');
  expect(result.evaluation?.localInputs?.weatherMode).toBe('open-meteo');
  expect(readPlantCareStatus).not.toHaveBeenCalled();
});
