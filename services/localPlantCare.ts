import type { Plant } from '@/firestoreModels';
import { defaultLocalCareSettings, evaluateLocalCare } from '@/lib/careAlgorithm/localCare';
import { loadLocalCareSettings } from './localCareSettings';
import { requireUserId } from './session';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import { plantDay } from '@/lib/dates/plantDay';
import { fetchWeather, readCachedWeatherResponse } from '@/lib/weather/fetchWeather';
import type { CareReadResult } from '@/lib/careAlgorithm/careDiagnostics';

/** Interactive path: reads existing inputs and calculates locally; no backend snapshot or server writes. */
export async function readLocalPlantCare(plantId: string, plant: Plant, now: Date): Promise<CareReadResult> {
  const uid = requireUserId();
  if (!plant.owners.includes(uid)) throw new Error('This plant is not in your account.');
  const at = now.getTime() / 1000;
  let settings; const issues: string[] = [];
  try { settings = await loadLocalCareSettings(plantId, at); }
  catch { settings = defaultLocalCareSettings(at); issues.push('local_test_settings_invalid'); }
  let logs: import('@/firestoreModels').PlantLog[] = [];
  let historyFailed = false;
  if (settings.enabled && settings.includeJournal && settings.anchorUtc <= at && at - settings.anchorUtc <= 14 * 86400) {
    try {
      const range = await fetchLogsAndWeatherForRange(plantId, plantDay(new Date(settings.anchorUtc * 1000), plant.locationTimeZone), plantDay(now, plant.locationTimeZone), plant.locationTimeZone, { logsOnly: true });
      logs = Object.values(range).flatMap(entry => entry.logs);
    } catch { historyFailed = true; }
  }
  const pin = plant.location;
  let raw = pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng) ? await readCachedWeatherResponse(pin.lat, pin.lng) : undefined;
  if (settings.enabled && settings.weatherMode === 'open-meteo' && pin) {
    try { raw = await fetchWeather(pin.lat, pin.lng); } catch { issues.push('local_meteo_unavailable'); }
  }
  if (requireUserId() !== uid) throw new Error('Account changed.');
  if (historyFailed) issues.push('local_journal_read_failed');
  const evaluationUtc = Math.max(at, Date.now() / 1000);
  const evaluation = evaluateLocalCare(plant, logs, settings, evaluationUtc, raw, raw?._weedgrowFetchedAt === undefined ? undefined : raw._weedgrowFetchedAt / 1000, issues);
  return { evaluation, diagnostic: { source: 'on_device', status: 'local_evaluation_available', checkedAtUtc: evaluationUtc,
    backendRevisionPresent: !!plant.careEvaluationRevision, journalHistoryReadFailed: historyFailed } };
}
