import React from 'react';
import { useOwnedGroups } from '@/hooks/useGardenData';
import { useSession } from '@/services/session';
import { useGardenWeatherCollection } from './useGardenWeatherCollection';
const WeatherContext = React.createContext<ReturnType<typeof useGardenWeatherCollection>>({ errors: {}, retry: async () => {} });
/** Keep free-plan collection available on every screen while the app is active. */
export default function GardenWeatherProvider({ children }: { children: React.ReactNode }) {
  const groups = useOwnedGroups(); const { user } = useSession();
  const collection = useGardenWeatherCollection(groups.groups, user?.uid);
  return <WeatherContext.Provider value={collection}>{children}</WeatherContext.Provider>;
}
export const useGardenWeather = () => React.useContext(WeatherContext);
