import { inspectWeatherReadings } from '../weatherReadings';

describe('general weather diagnostic reader', () => {
  it('isolates invalid variables, rows and arrays without losing valid current wind', () => {
    const report = inspectWeatherReadings({
      current: { dt: 100, humidity: '55', wind_speed: 12, temp: 20, rain: null },
      hourly: [{ dt: '101', wind_speed: 7 }, { dt: 102, wind_speed: 8 }],
      daily: {},
    });
    expect(report.readings).toHaveLength(2);
    expect(report.readings[0].windSpeedMs).toEqual({ value: 12, quality: 'ok', reason: null });
    expect(report.readings[0].humidityPct).toEqual({ value: null, quality: 'invalid', reason: 'not_finite_number' });
    expect(report.readings[1].path).toBe('$.hourly[1]');
    expect(report.issues).toEqual([
      { path: '$.hourly[0]', reason: 'invalid_time_axis' },
      { path: '$.daily', reason: 'invalid_array' },
    ]);
  });

  it('keeps omitted, null, invalid and zero precipitation distinct across JSON serialization', () => {
    const { readings } = JSON.parse(JSON.stringify(inspectWeatherReadings({ hourly: [
      { dt: 1 }, { dt: 2, rain: null }, { dt: 3, rain: { '1h': -1 } },
      { dt: 4, rain: { '1h': 0 } }, { dt: 5, rain: false },
    ] })));
    expect(readings.map((row: { rain1h: unknown }) => row.rain1h)).toEqual([
      { value: null, quality: 'missing', reason: 'not_provided' },
      { value: null, quality: 'missing', reason: 'explicit_null' },
      { value: null, quality: 'invalid', reason: 'out_of_range' },
      { value: 0, quality: 'ok', reason: null },
      { value: null, quality: 'invalid', reason: 'not_finite_number' },
    ]);
  });

  it.each([NaN, Infinity, -Infinity, true, '12', [], {}])('rejects nonnumeric wind %p', wind_speed => {
    const row = inspectWeatherReadings({ current: { dt: 0, wind_speed } }).readings[0];
    expect(row.windSpeedMs.value).toBeNull();
    expect(row.windSpeedMs.quality).toBe('invalid');
  });

  it('retains raw daily and hourly rain fields separately without adding snow', () => {
    const report = inspectWeatherReadings({
      hourly: [{ dt: 1, rain: { '1h': 2 }, snow: { '1h': 3 } }],
      daily: [{ dt: 2, rain: 25, temp: { day: 20 } }],
    });
    expect(report.readings[0].rain.value).toBeNull();
    expect(report.readings[0].rain1h.value).toBe(2);
    expect(report.readings[0].snow1h.value).toBe(3);
    expect(report.readings[1].rain.value).toBe(25);
    expect(report.readings[1].rain1h.value).toBeNull();
    expect(report.readings[1].temperatureC.value).toBe(20);
  });

  it('retains history array origin and UTC solar epochs without using timezone offsets', () => {
    const report = inspectWeatherReadings({ timezone_offset: 7200, data: [{ dt: 100, sunrise: 0, sunset: 200 }] });
    expect(report.readings[0]).toMatchObject({ origin: 'data', validAtUtc: 100, sunriseUtc: { value: 0 }, sunsetUtc: { value: 200 } });
  });

  it('reports malformed envelopes and bounded arrays without throwing', () => {
    expect(inspectWeatherReadings(null).issues).toEqual([{ path: '$', reason: 'invalid_envelope' }]);
    expect(inspectWeatherReadings({ hourly: Array(169).fill({ dt: 1 }) }).issues[0].reason).toBe('invalid_array');
    expect(inspectWeatherReadings({ current: { dt: 1e20 } }).readings).toEqual([]);
  });

  it('rejects physical range errors independently', () => {
    const row = inspectWeatherReadings({ current: { dt: 1, temp: -274, humidity: 101, wind_speed: -1, pop: 1.1, uvi: 0 } }).readings[0];
    for (const reading of [row.temperatureC, row.humidityPct, row.windSpeedMs, row.precipitationProbability]) {
      expect(reading.quality).toBe('invalid');
    }
    expect(row.uvIndex.value).toBe(0);
  });
});
