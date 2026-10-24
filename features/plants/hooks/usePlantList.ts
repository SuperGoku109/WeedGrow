import { invalidatePlantCache } from '@/services/gardenData';
export { invalidatePlantCache } from '@/services/gardenData';
export { useOwnedPlants as usePlantList } from '@/hooks/useGardenData';
// A successful write is already delivered by the live stream. Reconnect only
// failed streams rather than rereading the complete garden after every save.
export async function refreshPlantCache() { invalidatePlantCache(); }
