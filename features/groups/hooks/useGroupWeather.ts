import { useEffect, useState } from 'react';
import { fetchWeather } from '@/lib/weather/fetchWeather';

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
        const current = data?.current ?? {};
        const today = Array.isArray(data?.daily) && data.daily.length > 0 ? data.daily[0] : undefined;
        if (!active) return;
        const temperature = current.temp ?? today?.temp?.day;
        const humidity = current.humidity ?? today?.humidity;
        if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) throw new Error('The provider did not return usable current conditions.');
        setWeather({
          temperature: Math.round(temperature),
          rain: current.rain?.['1h'] ? Math.round(current.rain['1h']) : 0,
          humidity: Math.round(humidity),
          dayMax: typeof today?.temp?.max === 'number' ? Math.round(today.temp.max) : undefined,
          dayMin: typeof today?.temp?.min === 'number' ? Math.round(today.temp.min) : undefined,
          dailyRainMm: typeof today?.rain === 'number' ? Math.round(today.rain) : 0,
        });
      })
      .catch((err) => { if (active) setError(err.message || 'Failed to fetch weather'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [lat, lng]);

  return { weather, loading, error };
}
