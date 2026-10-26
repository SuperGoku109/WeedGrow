// useStep5Media.ts
// This hook manages the logic for the Media step in the Add Plant flow.
// It handles image picking (camera/gallery), snackbar state, and updating the form with the selected image.

import { useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import type { PlantForm, PlantFieldSetter } from '@/features/plants/form/PlantForm';
import * as ImagePicker from 'expo-image-picker';
import { BaseStepLogic } from '../types/StepLogic';
import { useStepBackground } from './useStepBackground';

// Interface for the logic returned by this hook
export interface Step5MediaLogic extends BaseStepLogic {
  tint: string;
  snackVisible: boolean;
  setSnackVisible(val: boolean): void;
  pickImage(fromCamera: boolean): Promise<void>;
  setField: PlantFieldSetter;
}

// Hook for managing the Media step logic
export function useStep5Media(
  form: PlantForm,
  setField: PlantFieldSetter
): Step5MediaLogic {
  // Get background color and theme tint
  const backgroundColor = useStepBackground();
  const scheme = (useColorScheme() ?? 'dark') as keyof typeof Colors;
  const tint = Colors[scheme].tint;

  // Snackbar state for photo selection
  const [snackVisible, setSnackVisible] = useState(false)

  // Pick image from camera or gallery
  const pickImage = async (fromCamera: boolean) => {
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images })

    if (!result.canceled) {
      setField('imageUri', result.assets[0].uri)
      setSnackVisible(true)
    }
  }

  // Return logic and state for the step
  return {
    backgroundColor,
    tint,
    snackVisible,
    setSnackVisible,
    pickImage,
    setField
  }
}
