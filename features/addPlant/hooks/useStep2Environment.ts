// features/addPlant/hooks/useStep2Environment.ts
// This hook manages the logic for the Environment step in the Add Plant flow.
// It handles environment selection, sensor profiles, pot/sunlight options, and dropdown menu state for the environment form step.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlantForm, PlantFieldSetter } from '@/features/plants/form/PlantForm';
import { BaseStepLogic } from '../types/StepLogic';
import { useStepBackground } from './useStepBackground';
import {
  potSizeOptions,
  sunlightOptions,
  fetchSensorProfiles,
} from '../api/environmentApi';

// Interface for the logic returned by this hook
export interface Step2EnvironmentLogic extends BaseStepLogic {
  insetsTop: number;
  environment: PlantForm['environment'];
  setField: PlantFieldSetter;
  sensorOptions: { label: string; value: string }[];
  loadingProfiles: boolean;
  sensorMenuVisible: boolean;
  openSensorMenu: () => void;
  closeSensorMenu: () => void;
  potMenuVisible: boolean;
  openPotMenu: () => void;
  closePotMenu: () => void;
  sunMenuVisible: boolean;
  openSunMenu: () => void;
  closeSunMenu: () => void;
  plantedIn: PlantForm['plantedIn'];
  potSizeOptions: string[];
  sunlightOptions: typeof sunlightOptions;
}

// Hook for managing the Environment step logic
export function useStep2Environment(
  form: PlantForm,
  setField: PlantFieldSetter
): Step2EnvironmentLogic {
  // Theming & safe area insets
  const backgroundColor = useStepBackground();
  const { top: insetsTop } = useSafeAreaInsets();

  // Dropdown menu state
  const [sensorMenuVisible, setSensorMenuVisible] = useState(false);
  const [potMenuVisible, setPotMenuVisible] = useState(false);
  const [sunMenuVisible, setSunMenuVisible] = useState(false);

  // Sensor profiles for indoor/greenhouse
  const [sensorProfiles, setSensorProfiles] = useState<{ id: string; name: string }[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  // Load sensor profiles when environment changes
  useEffect(() => {
    let isMounted = true;
    if (form.environment === 'indoor' || form.environment === 'greenhouse') {
      setLoadingProfiles(true);
      fetchSensorProfiles()
        .then(profiles => { if (isMounted) setSensorProfiles(profiles); })
        .finally(() => { if (isMounted) setLoadingProfiles(false); });
    } else {
      setSensorProfiles([]);
    }
    return () => { isMounted = false; };
  }, [form.environment]);

  // Handle deep-link to new sensor profile
  const params = useLocalSearchParams();
  useEffect(() => {
    const profileId = Array.isArray(params.newSensorProfileId) ? params.newSensorProfileId[0] : params.newSensorProfileId;
    if (profileId && profileId !== form.sensorProfileId) {
      setField('sensorProfileId', profileId);
    }
  }, [params.newSensorProfileId, form.sensorProfileId, setField]);

  // Build dropdown options for sensor profiles
  const sensorOptions = useMemo(
    () => sensorProfiles.map(p => ({ label: p.name, value: p.id })),
    [sensorProfiles]
  );

  // Memoize menu handlers for stability
  const openSensorMenu = useCallback(() => setSensorMenuVisible(true), []);
  const closeSensorMenu = useCallback(() => setSensorMenuVisible(false), []);
  const openPotMenu = useCallback(() => setPotMenuVisible(true), []);
  const closePotMenu = useCallback(() => setPotMenuVisible(false), []);
  const openSunMenu = useCallback(() => setSunMenuVisible(true), []);
  const closeSunMenu = useCallback(() => setSunMenuVisible(false), []);
  const stableSetField = useCallback(setField, [setField]);

  // Return logic and state for the step
  return {
    backgroundColor,
    insetsTop,
    environment: form.environment,
    plantedIn: form.plantedIn,
    setField: stableSetField,
    loadingProfiles,
    sensorMenuVisible,
    openSensorMenu,
    closeSensorMenu,
    sensorOptions,
    potMenuVisible,
    openPotMenu,
    closePotMenu,
    sunMenuVisible,
    openSunMenu,
    closeSunMenu,
    potSizeOptions,
    sunlightOptions,
  };
}
