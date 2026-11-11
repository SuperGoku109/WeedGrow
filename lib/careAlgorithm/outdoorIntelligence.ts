import { parseVolumeL } from './profiles';
import { windPlantContext, windThresholds } from './windPolicy';
import type { Plant, PlantLog } from '@/firestoreModels';
import type { WaterResult, WeatherSample } from './types';
import { careConfiguration, dryingConditions, normalizeObservations, normalizeOutdoorWeather, OUTDOOR_POLICY, utcSeconds, careEventWindow, localTemperatureBaseline,
  type Drying, type Observation, type OutdoorPolicy } from './outdoorContext';
export type CheckStatus = 'CHECK_NOW' | 'CHECK_SOON' | 'CHECK_LATER' | 'INSUFFICIENT_DATA';
export type HazardState = 'NO_CURRENT_SIGNAL' | 'WATCH' | 'INSPECT' | 'UNKNOWN';
export interface CareRecommendation {
  id: string; plantId: string; type: 'watering' | 'weather' | 'health'; category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH'; action: string; title: string; description: string; reasonCodes: string[];
  evidence: Record<string, unknown>; dataQuality: 'GOOD' | 'PARTIAL' | 'INSUFFICIENT';
  generatedAt: number; expiresAt: number; status: 'active' | 'dismissed' | 'resolved';
}
export interface OutdoorIntelligence {
  checkStatus: CheckStatus; nextCheckUtc: number | null; drying: Drying; latestObservation?: Observation; lastWateringUtc: number | null; lastWateringTimeKnown: boolean; timeZone: string;
  learning: { qualifiedTransitions: number; wetToMoistTransitions: number; adjustment: 'EARLIER' | 'BASELINE' | 'LATER'; configuration: string; feedback: { useful: number; too_early: number; too_late: number } };
  hazards: Record<string, HazardState>; resolvedRecommendationIds: string[]; recommendations: CareRecommendation[]; water: WaterResult;
}
/** Pure rules. Observations outrank care/weather; forecasts can prompt preparation only.
 * Thresholds are conservative inspection heuristics, not crop physiology or probabilities. */
export function evaluateOutdoorCare(input: { plantId: string; plant: Plant; logs: readonly PlantLog[]; samples: readonly WeatherSample[];
  nowUtc: number; historyReliable?: boolean; policy?: OutdoorPolicy }): OutdoorIntelligence {
  const { plantId, plant, nowUtc: now } = input;
  const logs = input.historyReliable === false ? [] : input.logs; const p = input.policy ?? OUTDOOR_POLICY;
  const windScreen = windThresholds(windPlantContext(plant), now);
  const windGustMs = input.policy ? p.severeWindMs : windScreen.gustMs;
  const windSustainedMs = input.policy ? p.severeSustainedWindMs : windScreen.sustainedMs;
  if (!Number.isFinite(now)) throw new Error('invalid_evaluation_time');
  const configuration = careConfiguration(plant);
  const weather = normalizeOutdoorWeather(input.samples, now, p).filter(s => s.location_revision === (plant.locationRevision ?? 0));
  const drying = dryingConditions(weather, plant, now, p);
  const observations = normalizeObservations(logs, now);
  const latest = observations.at(-1);
  const watering = logs.filter(l => l.type === 'watering' && (l.waterMl == null || typeof l.waterMl === 'number' && Number.isFinite(l.waterMl) && l.waterMl > 0))
    .flatMap(l => { const window = careEventWindow(l, plant, now); return window ? [{ ...window, precise: l.occurrencePrecision === 'time' }] : []; });
  const occurred = weather.filter(s => s.kind !== 'forecast');
  const allRain = occurred.filter(s => s.variable === 'liquid_rain_mm' && s.time_support === 'interval_sum');
  const rain = allRain.filter(s => s.valid_end_utc > now - 86400);
  const rainTotal = rain.reduce((sum, s) => sum + s.value!, 0);
  const exposed = plant.rainReception?.soil === 'yes' || plant.rainReception?.soil === 'partial';
  const userRain = logs.filter(l => ['LIGHT', 'MODERATE', 'HEAVY'].includes(l.rainfallObservation ?? '')).flatMap(l => { const window = careEventWindow(l, plant, now); return window ? [{ ...window, category: l.rainfallObservation!, source: 'user_confirmed' as const }] : []; });
  const recentUserRain = userRain.filter(e => e.end > now - 86400);
  const substantialUserRain = recentUserRain.some(e => e.category !== 'LIGHT');
  const rainAfter = (at: number, until = now) => plant.rainReception?.soil !== 'no' && (allRain.some(s => s.value! > 0 && s.valid_end_utc > at && s.valid_start_utc < until) || userRain.some(e => e.end > at && e.start <= until));
  const feedback = { useful: 0, too_early: 0, too_late: 0 };
  for (const o of observations) if (o.feedback && o.precise && o.configuration === configuration && Object.prototype.hasOwnProperty.call(feedback, o.feedback)) feedback[o.feedback]++;
  const learning = { feedback, wetToMoistTransitions: 0, qualifiedTransitions: 0, adjustment: 'BASELINE' as 'EARLIER' | 'BASELINE' | 'LATER', configuration };
  const transitions: number[] = [];
  for (let i = 1; i < observations.length; i++) {
    const a = observations[i - 1], b = observations[i], hours = (b.at - a.at) / 3600;
    if (!a.precise || !b.precise || a.configuration !== configuration || b.configuration !== configuration
      || a.at < now - p.learningWindowDays * 86400 || hours < p.minLearningGapHours || hours > p.maxLearningGapHours
      || watering.some(e => e.end >= a.at && e.start <= b.at) || rainAfter(a.at, b.at)) continue;
    const requiredVariables: WeatherSample['variable'][] = ['air_temperature_c', 'air_rh_pct', 'wind_speed_ms', ...(plant.rainReception?.soil !== 'no' ? ['liquid_rain_mm' as const] : [])];
    const complete = requiredVariables.every(variable => {
      const covered = new Set(occurred.filter(s => s.variable === variable).map(s => Math.floor(s.valid_end_utc / 3600)));
      for (let hour = Math.floor(a.at / 3600) + 1; hour <= Math.floor(b.at / 3600); hour++) if (!covered.has(hour)) return false;
      return true;
    });
    if (!complete) continue;
    const historicalDrying = dryingConditions(weather, plant, b.at, p);
    if (historicalDrying === 'UNKNOWN' || historicalDrying !== drying) continue;
    if (a.state === 'WET' && b.state === 'MOIST') learning.wetToMoistTransitions++;
    if (a.state === 'MOIST' && b.state === 'DRY') transitions.push(hours);
    if (a.state === 'MOIST' && b.state === 'MOIST' && hours >= p.checkHours) transitions.push(p.slowCheckHours);
  }
  learning.qualifiedTransitions = transitions.length;
  if (transitions.length >= p.learningTransitions) {
    const ordered = [...transitions].sort((a, b) => a - b); const median = ordered[Math.floor(ordered.length / 2)];
    learning.adjustment = median <= p.fastCheckHours ? 'EARLIER' : median >= p.slowCheckHours ? 'LATER' : 'BASELINE';
  }
  const recommendations: CareRecommendation[] = [];
  const hazards: Record<string, HazardState> = {};
  const add = (type: CareRecommendation['type'], category: string, action: string, title: string, description: string,
    code: string, priority: CareRecommendation['priority'] = 'MEDIUM', evidence: Record<string, unknown> = {}) => {
    recommendations.push({ id: `${plantId}:${type}:${category}`, plantId, type, category, priority, action, title, description,
      reasonCodes: [code], evidence, dataQuality: drying === 'UNKNOWN' || rain.length < 24 || input.historyReliable === false ? 'PARTIAL' : 'GOOD', generatedAt: now, expiresAt: now + p.recommendationLifetimeMinutes * 60, status: 'active' });
  };
  const summaryWatering = plant.careSummary?.version === 1 && plant.careSummary.revision === (plant.careRevision ?? 0) ? utcSeconds(plant.careSummary.watering?.timestamp) : null;
  const latestWater = [...watering].sort((a, b) => b.end - a.end)[0];
  const useSummary = summaryWatering !== null && summaryWatering <= now && (!latestWater || summaryWatering > latestWater.end);
  const lastWateringUtc = input.historyReliable === false ? null : useSummary ? summaryWatering : latestWater ? latestWater.precise ? latestWater.end : latestWater.start : null;
  const lastWateringTimeKnown = !useSummary && !!latestWater?.precise;
  const timeZone = plant.locationTimeZone || 'UTC';
  const empty: OutdoorIntelligence = { checkStatus: 'INSUFFICIENT_DATA', nextCheckUtc: null, lastWateringUtc, lastWateringTimeKnown, timeZone, drying, learning, hazards, resolvedRecommendationIds: [], recommendations,
    water: { decision: 'uncertain', needsWater: null, reasonCodes: ['outdoor_ineligible'] } };
  if (plant.environment !== 'outdoor' || plant.status !== 'active' || plant.deleting) return empty;
  const freshHours = drying === 'FAST' ? p.fastFreshnessHours : p.freshnessHours;
  const current = latest && latest.precise && now - latest.at < freshHours * 3600
    && (!latest.configuration || latest.configuration === configuration)
    && !watering.some(e => e.end >= latest.at) && !rainAfter(latest.at) ? latest : undefined;
  // Checking time and soil state are independent: an earlier check must never
  // turn a valid MOIST/WET report into a watering instruction.
  const recentWater = watering.filter(e => e.start >= now - p.wateringPauseHours * 3600);
  const rainPause = exposed && (rain.filter(s => s.valid_end_utc > now - p.wateringPauseHours * 3600).reduce((sum, s) => sum + s.value!, 0) >= p.moderateRainMm || recentUserRain.some(e => e.category !== 'LIGHT' && e.end > now - p.wateringPauseHours * 3600));
  const baseHours = drying === 'FAST' ? p.fastCheckHours : drying === 'SLOW' ? p.slowCheckHours : p.checkHours;
  let intervalHours = baseHours;
  if (plant.plantedIn === 'pot' && drying === 'FAST' && (parseVolumeL(plant.potSize) ?? Infinity) <= p.smallPotL) intervalHours -= p.smallPotCheckHours;
  if (plant.plantedIn === 'pot' && ['seedling', 'germination', 'clone'].includes(plant.growthStage)) intervalHours -= p.learningStepHours;
  intervalHours = Math.max(p.soonHours, intervalHours + (learning.adjustment === 'EARLIER' ? -p.learningStepHours : learning.adjustment === 'LATER' ? p.learningStepHours : 0));
  const timingObservation = latest && (!latest.configuration || latest.configuration === configuration) ? latest : undefined;
  let nextCheckUtc: number | null = timingObservation ? timingObservation.at + intervalHours * 3600 : drying === 'UNKNOWN' ? null : now;
  const forecastAttention = weather.filter(s => s.kind === 'forecast' && (
    s.variable === 'wind_gust_ms' && s.value! >= p.severeWindMs || s.variable === 'air_temperature_c' && (s.value! >= p.hotC || s.value! <= p.coldC
      || s.value! >= p.warmC && weather.some(other => other.kind === 'forecast' && other.valid_end_utc === s.valid_end_utc
        && (other.variable === 'air_rh_pct' && other.value! <= p.lowHumidity || other.variable === 'wind_speed_ms' && other.value! >= p.windMs)))))
    .sort((a, b) => a.valid_start_utc - b.valid_start_utc)[0];
  let forecastAdvances = !!forecastAttention && (!!latest || drying !== 'UNKNOWN') && (nextCheckUtc === null || forecastAttention.valid_start_utc < nextCheckUtc);
  if (forecastAdvances) nextCheckUtc = forecastAttention!.valid_start_utc;
  let checkStatus: CheckStatus = nextCheckUtc === null ? drying === 'UNKNOWN' ? 'INSUFFICIENT_DATA' : 'CHECK_NOW'
    : nextCheckUtc <= now ? 'CHECK_NOW' : nextCheckUtc <= now + p.soonHours * 3600 ? 'CHECK_SOON' : 'CHECK_LATER';
  let needsWater: boolean | null = null;
  let code = latest ? 'observation_stale_or_intervening_event' : 'no_moisture_observation';
  let description = 'Check the root-zone soil before deciding whether to water. Its current moisture is unknown.';
  let title = 'Check soil moisture'; let action = 'CHECK_SOIL';
  if (current) {
    if (current.state === 'DRY') { checkStatus = 'CHECK_NOW'; nextCheckUtc = now; }
    needsWater = current.state === 'DRY'; code = `recent_${current.state.toLowerCase()}_observation`;
    action = current.state === 'DRY' ? 'CONFIRM_DRY_SOIL' : 'REVIEW_SOIL';
    title = current.state === 'DRY' ? 'Watering may be appropriate' : `Soil reported ${current.state.toLowerCase()}`;
    description = current.state === 'DRY' ? 'You reported dry root-zone soil. Confirm it is still dry; watering may be appropriate. Log watering if you do it.'
      : `Your recent soil check reported ${current.state.toLowerCase()} soil. Avoid additional watering while it remains ${current.state.toLowerCase()}. ${drying === 'FAST' ? 'Recent warm, dry or windy conditions make an earlier check useful.' : 'Check again as conditions change.'}`;
  } else if (recentWater.length || rainPause) {
    const pauseAnchor = recentWater.length ? Math.max(...recentWater.map(e => e.end)) : Math.max(...rain.filter(s => s.value! > 0).map(s => s.valid_end_utc), ...recentUserRain.map(e => e.end));
    nextCheckUtc = Math.max(now, pauseAnchor + p.wateringPauseHours * 3600);
    if (forecastAttention && forecastAttention.valid_start_utc < nextCheckUtc) { nextCheckUtc = forecastAttention.valid_start_utc; forecastAdvances = true; }
    checkStatus = nextCheckUtc <= now ? 'CHECK_SOON' : nextCheckUtc <= now + p.soonHours * 3600 ? 'CHECK_SOON' : 'CHECK_LATER';
    code = recentWater.length ? 'recent_watering_check_later' : 'rain_wetting_uncertain';
    description = recentWater.length ? 'Watering was logged recently. This does not prove the soil is moist; check it before adding more water.'
      : `${substantialUserRain ? 'Your reported rainfall' : 'Recent API-modelled rain'} may have reached this plant. Check the root-zone soil; rainfall does not prove it was fully watered.`;
  } else if (drying === 'UNKNOWN' && !forecastAdvances) {
    checkStatus = 'INSUFFICIENT_DATA'; nextCheckUtc = null; code = 'weather_information_incomplete';
    description = 'Weather information is incomplete or stale. Check soil moisture directly rather than relying on an estimated watering schedule.';
  } else if (drying === 'FAST') description = 'Recent warm, dry or windy conditions may speed drying. Check the soil before deciding whether to water.';
  if (!current && timingObservation?.state === 'DRY' && now - timingObservation.at < freshHours * 3600 && !recentWater.length && !rainPause && drying !== 'UNKNOWN') { nextCheckUtc = now + p.soonHours * 3600; checkStatus = 'CHECK_SOON'; }
  if (current?.state !== 'DRY' && forecastAdvances) description += ' Forecast heat, wind or cold makes an earlier soil and exposure check useful; the forecast does not establish soil moisture.';
  if (current?.state !== 'DRY' && learning.adjustment !== 'BASELINE' && !recentWater.length && !rainPause) description += ` Based on your previous moisture checks in similar conditions, ${learning.adjustment === 'EARLIER' ? 'earlier' : 'more widely spaced'} inspections may be useful.`;
  const historyReliable = input.historyReliable !== false;
  if (!historyReliable) { needsWater = null; checkStatus = 'INSUFFICIENT_DATA'; nextCheckUtc = null; code = 'journal_history_unavailable'; title = 'Check soil moisture'; action = 'CHECK_SOIL'; description = 'Care history could not be read. Check the soil directly before watering.'; }
  const effectiveLatest = historyReliable ? latest : undefined;
  add('watering', 'soil-check', action, title, description, code, checkStatus === 'CHECK_NOW' ? 'MEDIUM' : 'LOW', {
    latestObservation: effectiveLatest ?? null, drying, checkStatus, nextCheckUtc,
    rainfallMm: rain.length ? rainTotal : null, rainProvenance: 'API model estimate',
    userConfirmedRain: recentUserRain, forecastRain: weather.filter(s => s.kind === 'forecast' && s.variable === 'liquid_rain_mm').map(s => ({ start: s.valid_start_utc, end: s.valid_end_utc, valueMm: s.value, source: s.provider })),
    rainfallCategory: !rain.length ? 'UNKNOWN' : rainTotal >= p.heavyRainMm ? 'HEAVY' : rainTotal >= p.moderateRainMm ? 'MODERATE' : rainTotal > 0 ? 'LIGHT' : 'NONE', rainExposure: plant.rainReception?.soil ?? 'unknown', learning,
  });
  if (checkStatus === 'INSUFFICIENT_DATA') recommendations[0].dataQuality = 'INSUFFICIENT';
  if (current) recommendations[0].expiresAt = Math.min(recommendations[0].expiresAt, current.at + freshHours * 3600);
  const weatherRules = [
    ['heat', 'air_temperature_c', (v: number) => v >= p.hotC, 'Prepare for heat', 'Check exposed leaves and provide suitable temporary shade.', 'HIGH'],
    ['cold', 'air_temperature_c', (v: number) => v <= p.coldC, 'Prepare for cold', 'Check vulnerable growth and consider temporary protection.', 'HIGH'],
    ['wind', 'wind_gust_ms', (v: number) => v >= windGustMs, 'Secure plants against wind', 'Secure containers and supports; inspect exposed growth for damage.', 'HIGH'],
    ['heavy-rain', 'liquid_rain_mm', (v: number) => v >= p.heavyRainMm, 'Prepare for heavy rain', 'Check drainage and exposed containers.', 'HIGH'],
  ] as const;
  for (const [category, variable, matches, heading, advice, priority] of weatherRules) {
    const signals = weather.filter(s => (s.variable === variable || category === 'wind' && s.variable === 'wind_speed_ms') && (category === 'wind' && s.variable === 'wind_speed_ms' ? s.value! >= windSustainedMs : matches(s.value!)) && s.valid_end_utc > now - p.signalFreshHours * 3600);
    const signal = signals.sort((a, b) => (category === 'cold' ? a.value! - b.value! : b.value! - a.value!) || Number(a.kind === 'forecast') - Number(b.kind === 'forecast') || a.valid_start_utc - b.valid_start_utc)[0];
    const windContext = signal && category === 'wind' ? `${signal.kind === 'forecast' ? 'Forecast' : 'Recently reported'} ${signal.variable === 'wind_gust_ms' ? 'gusts' : 'sustained wind'} of ${Math.round(signal.value! * 3.6)} km/h${signal.kind === 'forecast' ? ' within the next 24 hours' : ''}. ` : '';
    if (signal) add('weather', category, 'PREPARE_AND_INSPECT', heading, `${windContext || `${signal.kind === 'forecast' ? 'Forecast conditions' : 'Recent API-reported conditions'} may affect this plant. `}${advice}`, `${signal.kind === 'forecast' ? 'forecast' : 'observed_estimate'}_${category}`, priority,
      { ...(category === 'wind' ? { windScreen: { ...windScreen, sustainedMs: windSustainedMs, gustMs: windGustMs, ...(input.policy ? { basis: 'custom_policy', explanation: 'A custom test policy supplied these wind thresholds.' } : {}) } } : {}), phase: signal.kind, value: signal.value, startUtc: signal.valid_start_utc, endUtc: signal.valid_end_utc, provider: signal.provider, variable: signal.variable, notificationBand: category === 'wind' ? signal.value! >= p.extremeWindMs ? 'EXTREME' : 'STRONG' : category === 'heat' ? signal.value! >= p.extremeHeatC ? 'EXTREME' : 'HOT' : category === 'cold' ? signal.value! <= p.freezingC ? 'FROST' : 'COLD' : signal.value! >= p.extremeRainMm ? 'EXTREME' : 'HEAVY' });
  }
  const relativeWarm = weather.filter(s => s.variable === 'air_temperature_c' && s.valid_end_utc > now - p.signalFreshHours * 3600 && s.value! < p.hotC).find(s => {
    const baseline = localTemperatureBaseline(weather, plant, s.valid_end_utc, p);
    return baseline !== null && s.value! >= baseline + p.anomalyC;
  });
  if (relativeWarm && !recommendations.some(r => r.category === 'heat')) add('weather', 'temperature-anomaly', 'CHECK_EXPOSURE', 'Warmer than recent local conditions', `${relativeWarm.kind === 'forecast' ? 'Forecast' : 'Recent API-modelled'} temperatures are warmer than the same local hours on recent days. Check exposed growth and soil before changing care.`, relativeWarm.kind === 'forecast' ? 'forecast_local_warm_anomaly' : 'recent_local_warm_anomaly', 'MEDIUM', { phase: relativeWarm.kind, temperatureC: relativeWarm.value, baselineC: localTemperatureBaseline(weather, plant, relativeWarm.valid_end_utc, p), atUtc: relativeWarm.valid_end_utc });
  const futureRain = weather.filter(s => s.kind === 'forecast' && s.variable === 'liquid_rain_mm' && s.time_support === 'interval_sum');
  const forecastRainTotal = futureRain.reduce((sum, s) => sum + s.value!, 0);
  if (!recommendations.some(r => r.category === 'heavy-rain') && (rainTotal >= p.heavyRainMm || forecastRainTotal >= p.heavyRainMm)) {
    const past = rainTotal >= p.heavyRainMm;
    add('weather', 'heavy-rain', 'PREPARE_AND_INSPECT', 'Check exposure to heavy rain', `${past ? 'Recent API-modelled' : 'Forecast'} rain totals are substantial. Check drainage and exposed containers.`, past ? 'observed_estimate_heavy-rain' : 'forecast_heavy-rain', 'HIGH', { rainfallMm: past ? rainTotal : forecastRainTotal, phase: past ? 'occurred_estimate' : 'forecast' });
  }
  const recentTemp = occurred.find(s => s.variable === 'air_temperature_c' && s.valid_end_utc > now - 3 * 3600)?.value;
  const changing = recentTemp == null ? undefined : weather.find(s => s.kind === 'forecast' && s.variable === 'air_temperature_c' && Math.abs(s.value! - recentTemp) >= p.severeChangeC);
  if (changing) add('weather', 'temperature-change', 'PREPARE_AND_INSPECT', 'Prepare for a sharp weather change', 'Forecast temperature differs substantially from recent conditions. Check protection for exposed and vulnerable growth.', 'forecast_severe_temperature_change', 'HIGH', { recentC: recentTemp, forecastC: changing.value, atUtc: changing.valid_end_utc });
  const trend = (humidity: number, minC: number, maxC: number) => {
    const times = [...new Set(occurred.filter(s => s.variable === 'air_rh_pct' && s.value! >= humidity && s.valid_end_utc > now - p.humidTrendWindowHours * 3600).map(s => s.valid_end_utc))].sort((a, b) => a - b);
    let run = 0; let previous = -Infinity;
    for (const t of times) {
      const temp = occurred.find(s => s.variable === 'air_temperature_c' && s.valid_end_utc === t)?.value;
      run = temp != null && temp >= minC && temp <= maxC ? t - previous === 3600 ? run + 1 : 1 : 0;
      previous = t; if (run >= p.trendHours && t >= now - p.signalFreshHours * 3600) return true;
    }
    return false;
  };
  const humidityAvailable = trend(0, -60, 60);
  const sustainedHumidity = trend(p.highHumidity, -60, 60);
  const mildew = trend(p.highHumidity, p.mildewMinC, p.mildewMaxC); const botrytis = trend(p.botrytisHumidity, p.botrytisMinC, p.botrytisMaxC);
  hazards.powderyMildew = !humidityAvailable ? 'UNKNOWN' : mildew ? 'INSPECT' : 'NO_CURRENT_SIGNAL';
  hazards.botrytis = !humidityAvailable ? 'UNKNOWN' : botrytis ? plant.growthStage === 'flowering' ? 'INSPECT' : 'WATCH' : 'NO_CURRENT_SIGNAL';
  const healthEvidence = (threshold: number, minC: number, maxC: number) => ({ phase: 'occurred_estimate', windowStartUtc: now - p.humidTrendWindowHours * 3600, windowEndUtc: now, humidityThreshold: threshold, temperatureBandC: [minC, maxC], minimumConsecutiveHours: p.trendHours, canopyRainExposure: plant.rainReception?.canopy ?? 'unknown', sunlightExposure: plant.sunlightExposure ?? 'unknown' });
  const lastMildewCheck = Math.max(-Infinity, ...logs.filter(l => l.careCheck === 'powderyMildew' && l.inspectionResult === 'no_symptoms').map(l => utcSeconds(l.timestamp)).filter((t): t is number => t !== null && t <= now));
  const recentlyInspected = now - lastMildewCheck < p.freshnessHours * 3600;
  if (mildew && recentlyInspected) hazards.powderyMildew = 'WATCH';
  if (mildew) {
    add('health', 'powderyMildew', 'INSPECT_LEAVES', 'Inspect for powdery mildew', 'Sustained humid, mild conditions may favour powdery mildew. Inspect leaves for symptoms; weather cannot diagnose disease.', 'sustained_humidity_mildew', recentlyInspected ? 'LOW' : 'MEDIUM', { ...healthEvidence(p.highHumidity, p.mildewMinC, p.mildewMaxC), lastInspectionUtc: Number.isFinite(lastMildewCheck) ? lastMildewCheck : null });

  }
  if (sustainedHumidity) add('weather', 'humidity', 'CHECK_AIRFLOW', 'Sustained humid conditions', 'Recent humidity has persisted. Check airflow around dense or sheltered growth.', 'sustained_humidity', 'MEDIUM', healthEvidence(p.highHumidity, -60, 60));
  if (botrytis) add('health', 'botrytis', plant.growthStage === 'flowering' ? 'INSPECT_FLOWERS' : 'INSPECT_TISSUE', 'Inspect for grey mould', `Persistent very humid conditions warrant checking ${plant.growthStage === 'flowering' ? 'flowers and ' : ''}damaged or declining tissue where present. This is an inspection prompt, not a diagnosis.`, 'sustained_humidity_botrytis', 'MEDIUM', healthEvidence(p.botrytisHumidity, p.botrytisMinC, p.botrytisMaxC));
  const wet: Observation[] = [];
  for (const o of [...observations].reverse()) {
    if (o.state !== 'WET' || o.configuration && o.configuration !== configuration || o.at <= now - p.wetHistoryHours * 3600) break;
    wet.unshift(o);
  }
  const recentWetReport = latest?.state === 'WET' && now - latest.at < freshHours * 3600 && (!latest.configuration || latest.configuration === configuration);
  const repeatedWet = recentWetReport && wet.length >= 2 && wet.every(o => o.precise) && wet.at(-1)!.at - wet[0].at >= p.wetSpanHours * 3600;
  hazards.drainage = repeatedWet ? 'INSPECT' : exposed && rainTotal >= p.heavyRainMm ? 'WATCH' : latest ? 'NO_CURRENT_SIGNAL' : 'UNKNOWN';
  if (hazards.drainage === 'INSPECT' || hazards.drainage === 'WATCH') add('health', 'drainage', 'INSPECT_DRAINAGE', 'Check soil and drainage', repeatedWet ? 'Repeated checks report wet soil. Inspect drainage before adding water.' : 'Substantial modelled rain may have reached the soil. Inspect drainage; rain alone does not establish root problems.', repeatedWet ? 'persistent_wet_observations' : 'heavy_rain_drainage_watch', 'MEDIUM', { wetObservations: wet.map(o => ({ state: o.state, atUtc: o.at, precise: o.precise })), rainfallMm: rain.length ? rainTotal : null, rainExposure: plant.rainReception?.soil ?? 'unknown' });
  const pestLog = logs.some(l => l.category === 'pests' && (utcSeconds(l.timestamp) ?? Infinity) <= now && now - (utcSeconds(l.timestamp) ?? 0) <= p.pestFollowupDays * 86400);
  hazards.pests = pestLog ? 'WATCH' : 'UNKNOWN';
  if (pestLog) add('health', 'pests', 'INSPECT_LEAVES', 'Follow up your pest observation', 'A recent pest observation is recorded. Recheck leaves and stems for changes.', 'recent_pest_observation', 'MEDIUM', { userReported: true, windowStartUtc: now - p.pestFollowupDays * 86400 });
  hazards.exposure = recommendations.some(r => r.type === 'weather' && r.priority === 'HIGH') ? 'INSPECT' : ['air_temperature_c', 'wind_gust_ms', 'liquid_rain_mm'].every(v => weather.some(s => s.variable === v && s.valid_end_utc > now - p.signalFreshHours * 3600)) ? 'NO_CURRENT_SIGNAL' : 'UNKNOWN';
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const resolvedRecommendationIds: string[] = [];
  for (const [category, variable] of weatherRules) {
    if (!recommendations.some(r => r.type === 'weather' && r.category === category)
      && occurred.some(s => s.variable === variable && s.valid_end_utc > now - p.signalFreshHours * 3600)
      && weather.filter(s => s.kind === 'forecast' && s.variable === variable).length >= p.trendHours) resolvedRecommendationIds.push(`${plantId}:weather:${category}`);
  }
  for (const category of ['powderyMildew', 'botrytis', 'drainage']) if (hazards[category] === 'NO_CURRENT_SIGNAL') resolvedRecommendationIds.push(`${plantId}:health:${category}`);
  if (humidityAvailable && !sustainedHumidity) resolvedRecommendationIds.push(`${plantId}:weather:humidity`);
  if (historyReliable && checkStatus === 'CHECK_LATER') resolvedRecommendationIds.push(`${plantId}:watering:soil-check`);
  recommendations.sort((a, b) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id));
  return { checkStatus, nextCheckUtc, lastWateringUtc, lastWateringTimeKnown, timeZone, drying, latestObservation: effectiveLatest, learning, hazards, resolvedRecommendationIds, recommendations,
    water: { needsWater, decision: needsWater === null ? 'uncertain' : needsWater ? 'water' : 'not_due', reasonCodes: [code],
      estimate: { method: 'weather-history-rule', rule: code, explanation: description, lookbackHours: freshHours } } };
}
/** Delivery adapters can compare meaningful state; refresh timestamps alone never notify. */
export function recommendationSignature(r: CareRecommendation) { return JSON.stringify([r.id, r.priority, r.action, r.reasonCodes, r.evidence.notificationBand ?? null, r.evidence.phase ?? null, r.type === 'watering' ? r.evidence.checkStatus : null]); }
