import { repeatedPointForecast, currentWeatherFallback } from '../weatherQuality';
import { parseWeatherMeasurements } from '../weatherMeasurements';
const dt = Date.parse('2026-11-09T12:00:00Z') / 1000;
export const repeatedWeather = () => ({ timezone: 'Africa/Johannesburg', timezone_offset: 7200,
  current: { dt, temp: 11.79, humidity: 72, wind_speed: 4.6, uvi: 11.1 },
  daily: [{ dt, temp: { morn: 11.79, day: 11.79, eve: 11.79, night: 11.79, min: 11.79, max: 11.79 }, humidity: 72, wind_speed: 4.6, uvi: 11.1 }],
  hourly: [{ dt, temp: 11.79, humidity: 72 }] });
test('the reported single-point payload is not accepted as a daily forecast', () => {
  expect(repeatedPointForecast(repeatedWeather())).toBe(true);
  expect(() => parseWeatherMeasurements(repeatedWeather())).toThrow('repeated single-point forecast');
});
test('equal temperatures alone do not invalidate multi-hour forecasts', () => {
  const raw = repeatedWeather(); raw.hourly = Array.from({ length: 48 }, (_, i) => ({ ...raw.hourly[0], dt: dt + i * 3600 }));
  expect(repeatedPointForecast(raw)).toBe(false);
  expect(parseWeatherMeasurements(raw)['2026-11-09'].detailedTemps?.max).toBe(11.79);
});
test('a genuine daily forecast keeps distinct morning/evening/night and a 32/16 high/low', () => {
  const raw = repeatedWeather(); raw.current.temp = 25;
  raw.daily[0].temp = { morn: 18, day: 31, eve: 25, night: 19, min: 16, max: 32 };
  const day = parseWeatherMeasurements(raw)['2026-11-09'];
  expect(day.temperature).toBe(25); expect(day.detailedTemps).toEqual(raw.daily[0].temp);
  expect(day.observationUtc).toBe(dt); expect(day.weatherDataVersion).toBe(2);
});
test('a current-weather fallback cannot manufacture daily temperatures, UV or night humidity', () => {
  const fallback = currentWeatherFallback({ dt, timezone: 7200, main: { temp: 25, temp_min: 24, temp_max: 26, humidity: 28 },
    wind: { speed: 2 }, clouds: { all: 0 }, weather: [{ id: 800, description: 'clear sky' }] }, repeatedWeather());
  const day = parseWeatherMeasurements(fallback)['2026-11-09'];
  expect(day.temperature).toBe(25); expect(day.forecastIssue).toBe('repeated_point_forecast');
  expect(day.detailedTemps).toBeUndefined(); expect(day.uvIndex).toBeUndefined(); expect(day.nightHumidity).toBeUndefined();
  expect(fallback.hourly).toEqual([]); expect(fallback.daily).toEqual([]);
});
test('daily[0] for tomorrow is still a forecast and cannot overwrite today', () => {
  const raw = repeatedWeather(); raw.current.temp = 25;
  raw.daily[0].dt += 86400; raw.daily[0].temp.max = 32;
  const days = parseWeatherMeasurements(raw);
  expect(days['2026-11-09'].detailedTemps).toBeUndefined();
  expect(days['2026-11-10'].forecasted).toBe(true);
});
