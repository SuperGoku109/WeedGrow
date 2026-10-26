import { useSession } from '@/services/session';
import { getSensorProfile, type SensorProfile } from '@/services/sensorProfiles';
import { useAsyncResource } from './useAsyncResource';
export function useSensorProfile(id?: string) {
  const { user } = useSession();
  return useAsyncResource<SensorProfile | null>(user && id ? `${user.uid}:${id}` : null, () => getSensorProfile(id!), null, 'Sensor profile could not be loaded. Retry.');
}
