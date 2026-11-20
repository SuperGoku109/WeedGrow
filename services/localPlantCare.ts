import type { Plant } from '@/firestoreModels';
import { defaultLocalCareSettings, evaluateLocalCare } from '@/lib/careAlgorithm/localCare';
import { loadLocalCareSettings } from './localCareSettings';
import { requireUserId } from './session';
import { fetchLogsAndWeatherForRange } from '@/lib/logs/fetchLogsAndWeatherForRange';
import { plantDay, addDays, zonedTime } from '@/lib/dates/plantDay';
import { fetchWeather, readCachedWeatherResponse } from '@/lib/weather/fetchWeather';
import type { CareReadResult } from '@/lib/careAlgorithm/careDiagnostics';

async function readCareWeather(pin: Plant['location'], refresh: boolean) {
  if (!pin) return { raw: undefined, failed: false };
  if (refresh) {
    try { return { raw: await fetchWeather(pin.lat, pin.lng), failed: false }; }
    catch { /* Fall back to locally saved weather. */ }
  }
  const raw = Number.isFinite(pin.lat) && Number.isFinite(pin.lng)
    ? await readCachedWeatherResponse(pin.lat, pin.lng)
    : undefined;
  return { raw, failed: refresh };
}

/** Interactive path: reads existing inputs and calculates locally; no backend snapshot or server writes. */
export async function readLocalPlantCare(plantId: string, plant: Plant, now: Date): Promise<CareReadResult> {
  const uid = requireUserId();
  if (!plant.owners.includes(uid)) throw new Error('This plant is not in your account.');
  const at = now.getTime() / 1000;
  let zone = plant.locationTimeZone || 'UTC';
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(now); } catch { zone = 'UTC'; }
  let settings; const issues: string[] = [];
  try { settings = await loadLocalCareSettings(plantId, at); }
  catch { settings = defaultLocalCareSettings(at); issues.push('local_test_settings_invalid'); }
  const automatic = settings.profileMode !== 'manual' ? { basis: ['Soil observations', 'Care history', 'Qualitative weather'] } : undefined;
  if (automatic) settings = { ...settings, enabled: true, weatherMode: 'open-meteo' as const, includeJournal: true, anchorUtc: zonedTime(addDays(plantDay(now, zone), -13), '00:00', zone).getTime() / 1000 };
  const readHistory = settings.enabled && settings.includeJournal && settings.anchorUtc <= at && at - settings.anchorUtc <= 14 * 86400;
  const [history, { raw, failed: weatherFailed }] = await Promise.all([
    readHistory
      ? fetchLogsAndWeatherForRange(plantId, plantDay(new Date(settings.anchorUtc * 1000), zone), plantDay(now, zone), zone, { logsOnly: true }).catch(() => null)
      : undefined,
    readCareWeather(plant.location, settings.enabled && settings.weatherMode === 'open-meteo'),
  ]);
  if (requireUserId() !== uid) throw new Error('Account changed.');
  const historyFailed = history === null;
  const logs = history ? Object.values(history).flatMap(entry => entry.logs) : [];
  if (weatherFailed) issues.push('local_meteo_unavailable');
  if (historyFailed) issues.push('local_journal_read_failed');
  const evaluationUtc = Math.max(at, Date.now() / 1000);
  const identifiedPlant = { ...plant, id: plantId, locationTimeZone: zone };
  const evaluation = evaluateLocalCare(identifiedPlant, logs, settings, evaluationUtc, raw, raw?._weedgrowFetchedAt === undefined ? undefined : raw._weedgrowFetchedAt / 1000, issues, automatic);
  return { evaluation, diagnostic: { source: 'on_device', status: 'local_evaluation_available', checkedAtUtc: evaluationUtc,
    backendRevisionPresent: !!plant.careEvaluationRevision, journalHistoryReadFailed: historyFailed } };
}
