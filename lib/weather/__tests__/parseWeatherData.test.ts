import { parseWeatherData } from '@/lib/weather/parseWeatherData';
jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: () => ({ toDate: () => new Date('2026-02-10T00:00:00Z') }),
  },
}));



function toUnix(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

describe('parseWeatherData', () => {
  it('keeps observed current rainfall for today while merging daily temperature segments', () => {
    const dateKey = '2026-02-10';
    const parsed = parseWeatherData({
      timezone_offset: 0,
      current: {
        dt: toUnix('2026-02-10T12:00:00Z'),
        temp: 24,
        humidity: 55,
        wind_speed: 6,
        rain: 0,
        uvi: 4,
        weather: [{ description: 'clear' }],
        dew_point: 10,
        clouds: 20,
        wind_gust: 9,
        pop: 0.2,
      },
      daily: [
        {
          dt: toUnix('2026-02-10T00:00:00Z'),
          temp: {
            morn: 19,
            day: 26,
            eve: 22,
            night: 16,
            min: 14,
            max: 30,
          },
          humidity: 72,
          wind_speed: 8,
          rain: 12,
          uvi: 6,
          weather: [{ description: 'rain' }],
          dew_point: 14,
          clouds: 65,
          wind_gust: 12,
          pop: 0.8,
        },
      ],
      hourly: [],
    });

    expect(parsed[dateKey].forecasted).toBe(false);
    expect(parsed[dateKey].rainfall).toBe(0);
    expect(parsed[dateKey].humidity).toBe(55);
    expect(parsed[dateKey].pop).toBe(0.8);
    expect(parsed[dateKey].detailedTemps?.max).toBe(30);
  });

  it('derives nightHumidity from nighttime hourly samples', () => {
    const dateKey = '2026-02-10';
    const parsed = parseWeatherData({
      timezone_offset: 0,
      current: {
        dt: toUnix('2026-02-10T12:00:00Z'),
        temp: 24,
        humidity: 50,
        wind_speed: 5,
        rain: 0,
        uvi: 3,
        weather: [{ description: 'clear' }],
        dew_point: 11,
        clouds: 25,
        wind_gust: 8,
        pop: 0.1,
      },
      daily: [],
      hourly: [
        { dt: toUnix('2026-02-10T01:00:00Z'), temp: 17, humidity: 80 },
        { dt: toUnix('2026-02-10T13:00:00Z'), temp: 28, humidity: 40 },
        { dt: toUnix('2026-02-10T22:00:00Z'), temp: 18, humidity: 90 },
      ],
    });

    expect(parsed[dateKey].nightHumidity).toBe(85);
  });
});
