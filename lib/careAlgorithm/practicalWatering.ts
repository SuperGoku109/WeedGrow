import type { OpenMeteoPayload } from '@/lib/weather/openMeteo';
import { meteoLiquidRain, meteoValue } from '@/lib/weather/openMeteo';
import type { WaterEvent } from './events';
import type { Setup, WaterResult } from './types';

/** Product heuristics, not calibrated crop thresholds. Only past, completed hours
 * count. Missing weather and missing journal reads must never become "no rain/water". */
export function practicalWatering(input: { setup: Setup; events: readonly WaterEvent[]; raw: OpenMeteoPayload;
  nowUtc: number; retrievedUtc: number; anchorUtc: number }): WaterResult | null {
  const { setup, raw, nowUtc: now, retrievedUtc, anchorUtc } = input;
  if (setup.status !== 'active' || setup.deleting || setup.environment !== 'outdoor'
    || retrievedUtc > now || now - retrievedUtc >= 3600) return null;
  const end = Math.floor(now / 3600) * 3600;
  const result = (needsWater: boolean | null, rule: string, explanation: string, hours: number): WaterResult => ({
    decision: needsWater === null ? 'uncertain' : needsWater ? 'water' : 'not_due', needsWater,
    reasonCodes: ['practical_weather_estimate', rule],
    estimate: { method: 'weather-history-rule', rule, explanation, lookbackHours: hours },
  });
  // A dated record only establishes a pause if the entire possible occurrence
  // window is recent. An explicit zero is not watering; an unspecified amount is.
  const normalWaterL = Math.max(.05, (setup.potVolumeL ?? 5) * .02);
  const recent = input.events.some(e => !e.deleted && (e.appliedL === null || e.appliedL >= normalWaterL)
    && e.startUtc >= now - 12 * 3600 && e.endUtc <= now);
  if (recent) return result(false, 'recent_watering_pause',
    'Watering was logged within the last 12 hours. More water is probably not needed yet; check the soil before watering again. This assumes the logged watering was a normal watering, not just a small splash.', 12);

  const hours = (length: number) => {
    if (anchorUtc > end - length * 3600) return null;
    const rows: number[] = [];
    for (let t = end - (length - 1) * 3600; t <= end; t += 3600) {
      const i = raw.hourly.time.indexOf(t);
      if (i < 0) return null;
      rows.push(i);
    }
    return rows;
  };
  const rainTotal = (rows: number[]) => {
    if (setup.soilRain === 'no') return 0;
    const values = rows.map(i => meteoLiquidRain(raw.hourly, i));
    return values.every(v => v !== undefined) ? values.reduce<number>((sum, v) => sum + v!, 0) : null;
  };
  const last12 = hours(12);
  if (last12 && setup.soilRain === 'yes') {
    const rain = rainTotal(last12);
    const demand = last12.map(i => meteoValue(raw.hourly, 'et0_fao_evapotranspiration', i));
    if (rain !== null && rain >= 5 && demand.every(v => v !== undefined) && demand.reduce<number>((s, v) => s + v!, 0) <= 1.5)
      return result(false, 'recent_soaking_rain', 'At least 5 mm of rain is modelled in the last 12 hours, the plant is exposed to rain, and drying demand has been low. Watering is probably not needed yet; check the soil first.', 12);
  }

  // Shade/large containers get a longer dry spell. Unknown volume does not block
  // this rule: it makes no assertion about litres stored in the root zone.
  const length = setup.sun?.trim().toLowerCase() === 'mostly shade' || (setup.potVolumeL ?? 0) > 40 ? 72 : 48;
  const rows = hours(length);
  if (!rows) return null;
  const rain = rainTotal(rows);
  if (rain === null || rain >= 2) return null;
  if (input.events.some(e => !e.deleted && e.appliedL !== 0 && e.endUtc > end - length * 3600 && e.startUtc <= now)) return null;
  for (let offset = 0; offset < length; offset += 24) {
    const day = rows.slice(offset, offset + 24);
    const temperatures = day.map(i => meteoValue(raw.hourly, 'temperature_2m', i));
    const demand = day.map(i => meteoValue(raw.hourly, 'et0_fao_evapotranspiration', i));
    // Three hot hours avoids triggering from a brief spike. ET0 includes the
    // provider's temperature, humidity, wind and radiation effects when available.
    const hot = temperatures.filter(v => v !== undefined && v >= 28).length >= 3;
    const drying = demand.every(v => v !== undefined) && demand.reduce<number>((s, v) => s + v!, 0) >= 4;
    if (!hot && !drying) return null;
  }
  return result(true, 'sustained_hot_dry_no_watering',
    `Watering is recommended: the last ${length / 24} days have been hot or had strong drying demand, ${setup.soilRain === 'no' ? 'rain does not reach this plant' : 'less than 2 mm of rain is modelled over that period'}, and no watering is logged in that time. The plant is likely to need water. If you watered without logging it or the soil is still moist, skip watering and update the journal.`, length);
}
