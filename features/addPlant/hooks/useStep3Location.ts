// useStep3Location.ts
// This hook manages the logic for the Location step in the Add Plant flow.
// It handles geolocation permissions, fetching device location, and validation for the location form step.

import { useState, useMemo, useCallback } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import type { PlantForm, PlantFieldSetter } from '@/features/plants/form/PlantForm';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { BaseStepLogic } from '../types/StepLogic';
import { useStepBackground } from './useStepBackground';

// Interface for the logic returned by this hook
export interface Step3LocationLogic extends BaseStepLogic {
  tint: string;
  loading: boolean;
  isValid: boolean;
  getLocation(): Promise<void>;
  setField: PlantFieldSetter;
}

// Hook for managing the Location step logic
export function useStep3Location(
  form: PlantForm,
  setField: PlantFieldSetter
): Step3LocationLogic {
  // Get background color and theme tint
  const backgroundColor = useStepBackground();
  const scheme = (useColorScheme() ?? 'dark') as keyof typeof Colors;
  const tint = Colors[scheme].tint;
  const [loading, setLoading] = useState(false);

  // Valid if a location is set
  const isValid = useMemo(() => {
    return !!form.location
  }, [form.location])

  // Stable setField function
  const stableSetField = useCallback(setField, [setField]);

  // Request device location and update form
  const getLocation = useCallback(async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }

      // Try last known location, fallback to current
      const lastKnown = await Location.getLastKnownPositionAsync();
      const coords = lastKnown?.coords
        ? lastKnown.coords
        : (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords;

      stableSetField('location', { lat: coords.latitude, lng: coords.longitude });
    } catch (error) {
      console.error('Location error:', error);
    } finally {
      setLoading(false);
    }
  }, [stableSetField]);

  // Return logic and state for the step
  return {
    backgroundColor,
    tint,
    loading,
    isValid,
    getLocation,
    setField: stableSetField,
  }
}
