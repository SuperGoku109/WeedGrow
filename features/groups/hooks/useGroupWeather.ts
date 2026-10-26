import { useEffect, useState } from 'react';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import type { WeatherSample } from '@/lib/weather/weatherResponse';

export interface SimpleWeather {
  temperature: number;
  rain: number; // current hour rain (mm) if available
  humidity: number;
  // New optional fields for daily summary
  dayMax?: number; // today's forecast max temp (°C)
  dayMin?: number; // today's forecast min temp (°C)
  dailyRainMm?: number; // today's total rain (mm)
}

export function useGroupWeather(lat?: number, lng?: number) {
  const [weather, setWeather] = useState<SimpleWeather | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setWeather(null); setError(null);
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { setLoading(false); return; }
    setLoading(true);
    fetchWeather(lat, lng)
      .then((data) => {
        // OpenWeatherMap OneCall 3.0 API: current weather is in data.current; daily forecast in data.daily[0]
        const current: Partial<WeatherSample> = data?.current ?? {};
        const today = Array.isArray(data?.daily) && data.daily.length > 0 ? data.daily[0] : undefined;
        if (!active) return;
        const dailyTemp = typeof today?.temp === 'object' ? today.temp : undefined;
        const temperature = typeof current.temp === 'number' ? current.temp : dailyTemp?.day;
        const humidity = current.humidity ?? today?.humidity;
        if (typeof temperature !== 'number' || typeof humidity !== 'number' || !Number.isFinite(temperature) || !Number.isFinite(humidity)) throw new Error('The provider did not return usable current conditions.');
        setWeather({
          temperature: Math.round(temperature),
          rain: Math.round((typeof current.rain === 'number' ? current.rain : current.rain?.['1h']) || 0),
          humidity: Math.round(humidity),
          dayMax: typeof dailyTemp?.max === 'number' ? Math.round(dailyTemp.max) : undefined,
          dayMin: typeof dailyTemp?.min === 'number' ? Math.round(dailyTemp.min) : undefined,
          dailyRainMm: typeof today?.rain === 'number' ? Math.round(today.rain) : 0,
        });
      })
      .catch((err) => { if (active) setError(err.message || 'Failed to fetch weather'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lat, lng]);

  return { weather, loading, error };
}
