import type { Plant } from '@/firestoreModels';
import { validatePlantFields } from '@/lib/plants/plantValidation';
export type EditPlantFormState = {
  name: string;
  height: string;
  strain: string;
  potSize: string;
  growthStage: string;
  environment: string;
  sunlightExposure: string;
  locationNickname: string;
  locationLabel: string;
  locationMode: 'custom' | 'space';
  lat: string;
  lng: string;
};

export type EditPlantFormErrors = {
  name?: string;
  height?: string;
  lat?: string;
  lng?: string;
  location?: string;
  growthStage?: string;
  environment?: string;
};

export const emptyFormState: EditPlantFormState = {
  name: '',
  height: '',
  strain: '',
  potSize: '',
  growthStage: '',
  environment: '',
  sunlightExposure: '',
  locationNickname: '',
  locationLabel: '',
  locationMode: 'custom',
  lat: '',
  lng: '',
};

export function buildInitialFormState(plant: Plant): EditPlantFormState {
  return {
    name: plant.name ?? '',
    height: typeof plant.height === 'number' ? String(plant.height) : '',
    strain: plant.strain ?? '',
    potSize: plant.potSize ?? '',
    growthStage: plant.growthStage ?? '',
    environment: plant.environment ?? '',
    sunlightExposure: plant.sunlightExposure ?? '',
    locationNickname: plant.locationNickname ?? '',
    locationLabel: plant.locationLabel ?? '',
    locationMode: plant.locationMode || 'custom',
    lat: typeof plant.location?.lat === 'number' ? String(plant.location.lat) : '',
    lng: typeof plant.location?.lng === 'number' ? String(plant.location.lng) : '',
  };
}

export function buildUpdates(form: EditPlantFormState, current: Plant) {
  const updates: Partial<Plant> = {};
  if (form.locationMode !== (current.locationMode || 'custom')) updates.locationMode = form.locationMode;

  const trimmedName = form.name.trim();
  if (trimmedName && trimmedName !== current.name) updates.name = trimmedName;

  const nextHeight = form.height.trim() ? Number(form.height) : null;
  const currentHeight = typeof current.height === 'number' ? current.height : null;
  if (currentHeight !== nextHeight) updates.height = nextHeight;

  const nextStrain = form.strain.trim();
  if ((current.strain ?? '') !== nextStrain) updates.strain = nextStrain;

  const nextPotSize = form.potSize.trim() || null;
  if ((current.potSize ?? null) !== nextPotSize) updates.potSize = nextPotSize;

  const nextStage = form.growthStage;
  if (nextStage && nextStage !== current.growthStage) updates.growthStage = nextStage as Plant['growthStage'];

  const nextEnvironment = form.environment;
  if (nextEnvironment && nextEnvironment !== current.environment) {
    updates.environment = nextEnvironment as Plant['environment'];
  }

  const nextSunlight = form.sunlightExposure.trim() || null;
  if ((current.sunlightExposure ?? null) !== nextSunlight) {
    updates.sunlightExposure = nextSunlight;
  }

  if ((current.locationLabel || '') !== form.locationLabel.trim()) updates.locationLabel = form.locationLabel.trim();
  const nextLocationNickname = form.locationNickname.trim() || null;
  const currentLocationNickname = current.locationNickname?.trim() || null;
  if (currentLocationNickname !== nextLocationNickname) {
    updates.locationNickname = nextLocationNickname;
  }

  const latFilled = form.lat.trim().length > 0;
  const lngFilled = form.lng.trim().length > 0;
  let nextLocation: Plant['location'] | null = null;
  if (latFilled && lngFilled) {
    nextLocation = { lat: Number(form.lat), lng: Number(form.lng) };
  }

  const currentLocation = current.location ?? null;
  const locationChanged =
    (!currentLocation && nextLocation) ||
    (currentLocation && !nextLocation) ||
    (currentLocation &&
      nextLocation &&
      (currentLocation.lat !== nextLocation.lat || currentLocation.lng !== nextLocation.lng));

  if (locationChanged) updates.location = nextLocation;

  return updates;
}

export function validateForm(form: EditPlantFormState) {
  const nextErrors: EditPlantFormErrors = validatePlantFields({ name: form.name, height: form.height.trim() ? Number(form.height) : null, growthStage: form.growthStage, environment: form.environment });

  const latFilled = form.lat.trim().length > 0;
  const lngFilled = form.lng.trim().length > 0;
  if (latFilled || lngFilled) {
    if (!latFilled || !lngFilled) {
      nextErrors.location = 'Enter both latitude and longitude.';
    } else {
      const lat = Number(form.lat);
      const lng = Number(form.lng);

      if (Number.isNaN(lat)) nextErrors.lat = 'Latitude must be a number.';
      if (Number.isNaN(lng)) nextErrors.lng = 'Longitude must be a number.';

      if (!nextErrors.lat && (lat < -90 || lat > 90)) {
        nextErrors.lat = 'Latitude must be between -90 and 90.';
      }
      if (!nextErrors.lng && (lng < -180 || lng > 180)) {
        nextErrors.lng = 'Longitude must be between -180 and 180.';
      }
    }
  }

  return nextErrors;
}

