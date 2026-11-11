import type { SuggestionCard } from '@/lib/suggestions/types';
import type { JournalCategory } from '@/lib/logs/plantJournal';

export interface CareFact { label: string; value: string }
export function careAction(card: SuggestionCard): { label: string; category: JournalCategory; context?: 'soil-check'; icon: 'water-outline' | 'sprout' | 'leaf' } | null {
  if (card.kind === 'watering') {
    if (card.metrics.action === 'CONFIRM_DRY_SOIL' || card.metrics.needsWater === true) return { label: 'Water', category: 'watering', icon: 'water-outline' };
    if (card.metrics.observationDriven === true) return { label: 'Check soil', category: 'health', context: 'soil-check', icon: 'sprout' };
    return null;
  }
  return { label: card.kind === 'weather' || card.kind === 'weatherContext' ? 'Log check' : 'Log inspection', category: card.metrics.category === 'pests' ? 'pests' : 'health', icon: 'leaf' };
}
export function careFacts(card: SuggestionCard): CareFact[] {
  const facts: CareFact[] = [], e = card.evidence || {}, m = card.metrics;
  const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const stamp = (v: unknown, time = true) => {
    if (!number(v)) return null;
    try { return new Date(v * 1000).toLocaleString('en-GB', { timeZone: typeof m.timeZone === 'string' ? m.timeZone : 'UTC', day: 'numeric', month: 'short', ...(time ? { hour: '2-digit', minute: '2-digit' } : {}) }); } catch { return null; }
  };
  if (card.kind === 'watering') {
    const watered = stamp(m.lastWateringUtc, m.lastWateringTimeKnown === true);
    if (watered) facts.push({ label: 'Watering log', value: 'Last watering recorded ' + watered + '.' });
    if (typeof m.lastMoistureState === 'string') facts.push({ label: 'Soil report', value: 'You reported ' + m.lastMoistureState.toLowerCase() + ' soil' + (stamp(m.lastObservationUtc) ? ' on ' + stamp(m.lastObservationUtc) : '') + '. This is a logged observation.' });
    else if (m.observationDriven) facts.push({ label: 'Soil report', value: 'No usable soil observation is available to establish current moisture.' });
  }
  const drying = { FAST: 'Recent conditions are classified as faster drying.', NORMAL: 'Recent conditions are classified as typical drying.', SLOW: 'Recent conditions are classified as slower drying.', UNKNOWN: 'Weather information is incomplete or stale.' } as Record<string, string>;
  if (typeof e.drying === 'string' && drying[e.drying]) facts.push({ label: 'Weather', value: drying[e.drying] });
  if (number(e.rainfallMm)) facts.push({ label: 'Rain estimate', value: e.rainfallMm.toLocaleString() + ' mm in the recent modelled weather history. This is not a watering log.' });
  if (Array.isArray(e.userConfirmedRain) && e.userConfirmedRain.length) facts.push({ label: 'Rain reports', value: e.userConfirmedRain.length + ' recent rainfall reports were recorded in your journal.' });
  if (e.rainExposure === 'yes' || e.rainExposure === 'no' || e.rainExposure === 'partial') facts.push({ label: 'Rain exposure', value: e.rainExposure === 'yes' ? 'The soil is recorded as exposed to rain.' : e.rainExposure === 'no' ? 'The soil is recorded as sheltered from rain.' : 'The soil is recorded as partly sheltered from rain.' });
  const variable = { air_temperature_c: ['Temperature', '°C'], wind_gust_ms: ['Wind gust', ' km/h'], wind_speed_ms: ['Sustained wind', ' km/h'], liquid_rain_mm: ['Rain', ' mm'] } as Record<string, string[]>;
  if (e.windScreen && typeof e.windScreen === 'object') {
    const screen = e.windScreen as Record<string, unknown>;
    if (typeof screen.explanation === 'string' && number(screen.sustainedMs) && number(screen.gustMs)) facts.push({ label: 'Wind sensitivity',
      value: screen.explanation + ` Preparation threshold: ${Math.round(screen.sustainedMs * 3.6)} km/h sustained or ${Math.round(screen.gustMs * 3.6)} km/h gusts.` });
  }
  if (typeof e.variable === 'string' && variable[e.variable] && number(e.value)) {
    const [label, unit] = variable[e.variable];
    const value = e.variable === 'wind_gust_ms' || e.variable === 'wind_speed_ms' ? Math.round(e.value * 3.6) : e.value;
    facts.push({ label: e.phase === 'forecast' ? 'Forecast' : 'Weather report', value: label + ': ' + value + unit + (typeof e.provider === 'string' ? ' from ' + e.provider : '') + (stamp(e.startUtc) ? ' at ' + stamp(e.startUtc) : '') + '.' });
  }
  for (const [key, label] of [['temperatureC', 'Temperature'], ['baselineC', 'Recent local baseline'], ['recentC', 'Recent temperature'], ['forecastC', 'Forecast temperature']] as const) if (number(e[key])) facts.push({ label, value: e[key] + '°C' });
  if (number(e.humidityThreshold) && number(e.minimumConsecutiveHours)) facts.push({ label: 'Weather pattern', value: 'The rule found at least ' + e.minimumConsecutiveHours + ' consecutive hours meeting its ' + e.humidityThreshold + '% humidity screen.' });
  if (Array.isArray(e.wetObservations) && e.wetObservations.length) facts.push({ label: 'Soil history', value: e.wetObservations.length + ' wet-soil reports were included in the drainage check.' });
  if (e.userReported === true && m.category === 'pests') facts.push({ label: 'Your journal', value: 'A recent pest observation triggered this follow-up.' });
  if (number(e.lastInspectionUtc) && stamp(e.lastInspectionUtc)) facts.push({ label: 'Inspection log', value: 'A previous inspection was recorded on ' + stamp(e.lastInspectionUtc) + '.' });
  if (e.learning && typeof e.learning === 'object') {
    const learning = e.learning as Record<string, unknown>;
    if (number(learning.qualifiedTransitions) && (learning.adjustment === 'EARLIER' || learning.adjustment === 'LATER')) facts.push({ label: 'Previous checks', value: 'Inspection timing was adjusted ' + (learning.adjustment === 'EARLIER' ? 'earlier' : 'later') + ' using ' + learning.qualifiedTransitions + ' usable observation transitions.' });
  }
  if (stamp(m.evaluatedAtUtc)) facts.push({ label: 'Updated', value: stamp(m.evaluatedAtUtc)! });
  return facts;
}
