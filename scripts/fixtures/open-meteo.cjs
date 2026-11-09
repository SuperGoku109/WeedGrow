/** Synthetic provider contract fixture, never used by the app or real weather requests. */
module.exports = function meteoFixture(now = Date.now() / 1000) {
  const day = Math.floor(now / 86400) * 86400;
  const hourly = { time: Array.from({ length: 120 }, (_, i) => day - 2 * 86400 + i * 3600) };
  const definitions = { temperature_2m: ['°C', 25], relative_humidity_2m: ['%', 55], dew_point_2m: ['°C', 15], wind_speed_10m: ['m/s', 3],
    wind_gusts_10m: ['m/s', 5], shortwave_radiation: ['W/m²', 300], et0_fao_evapotranspiration: ['mm', .1], rain: ['mm', 0], showers: ['mm', 0],
    precipitation: ['mm', 0], snowfall: ['cm', 0], cloud_cover: ['%', 20], precipitation_probability: ['%', 0], weather_code: ['wmo code', 0], uv_index: ['', 6] };
  const hourly_units = { time: 'unixtime' };
  for (const [key, [unit, value]] of Object.entries(definitions)) { hourly_units[key] = unit; hourly[key] = hourly.time.map(() => value); }
  hourly.temperature_2m = hourly.time.map(t => 21 + 8 * Math.sin((t % 86400 / 3600 - 6) * Math.PI / 12));
  const daily = { time: Array.from({ length: 5 }, (_, i) => day - 2 * 86400 + i * 86400) };
  const daily_units = { time: 'unixtime' };
  for (const [key, unit, value] of [['temperature_2m_max', '°C', 29], ['temperature_2m_min', '°C', 13], ['rain_sum', 'mm', 0],
    ['showers_sum', 'mm', 0], ['uv_index_max', '', 8], ['precipitation_probability_max', '%', 0]]) {
    daily_units[key] = unit; daily[key] = daily.time.map(() => value);
  }
  for (const [key, offset] of [['sunrise', 6 * 3600], ['sunset', 18 * 3600]]) { daily_units[key] = 'unixtime'; daily[key] = daily.time.map(t => t + offset); }
  return { latitude: -34.05, longitude: 18.78, timezone: 'UTC', utc_offset_seconds: 0,
    current_units: { time: 'unixtime', interval: 'seconds', ...hourly_units },
    current: { time: Math.floor(now / 900) * 900, interval: 900, temperature_2m: 25, relative_humidity_2m: 55, dew_point_2m: 15,
      wind_speed_10m: 3, wind_gusts_10m: 5, cloud_cover: 20, weather_code: 0, rain: 0, showers: 0 }, hourly, hourly_units, daily, daily_units };
};
