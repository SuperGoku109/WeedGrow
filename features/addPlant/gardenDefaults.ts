import type { Group } from '@/firestoreModels';
import type { PlantForm } from '@/features/plants/form/PlantForm';

export function withGardenDefaults(form: PlantForm, garden?: (Group & { id: string }) | null): PlantForm {
  if (!garden) return form;
  return { ...form, groupId: garden.id, groupName: garden.name, environment: garden.environment,
    locationMode: 'space', location: garden.location, locationLabel: garden.locationLabel || garden.name,
    locationNickname: garden.name, latitudeInput: garden.location ? String(garden.location.lat) : '',
    longitudeInput: garden.location ? String(garden.location.lng) : '', sensorProfileId: garden.sensorProfileId || '' };
}
