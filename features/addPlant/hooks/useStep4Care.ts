// useStep4Care.ts
// This hook manages the logic for the Care step in the Add Plant flow.
// It handles watering, pest, and training technique selection for the care form step.

import { useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import type { PlantForm, PlantFieldSetter } from '@/features/plants/form/PlantForm';
import { BaseStepLogic } from '../types/StepLogic';
import { useStepBackground } from './useStepBackground';

// Interface for the logic returned by this hook
export interface Step4CareLogic extends BaseStepLogic {
  tint: string;
  textColor: string;
  waterMenu: boolean;
  setWaterMenu: (val: boolean) => void;
  wateringOptions: string[];
  pestOptions: string[];
  trainingOptions: string[];
  setField: PlantFieldSetter;
  togglePest: (pest: string) => void;
  toggleTraining: (training: string) => void;
}

// Hook for managing the Care step logic
export function useStep4Care(
  form: PlantForm,
  setField: PlantFieldSetter
): Step4CareLogic {
  // Get background color and theme tint
  const backgroundColor = useStepBackground();
  const scheme = (useColorScheme() ?? 'dark') as keyof typeof Colors;
  const tint = Colors[scheme].tint;
  const textColor = Colors[scheme].text;

  // State for watering menu
  const [waterMenu, setWaterMenu] = useState(false)

  // Options for dropdowns and chips
  const wateringOptions = ['Every day', 'Every 2 days', 'Every 3 days', 'Weekly']
  const pestOptions = ['Spider Mites', 'Powdery Mildew', 'Aphids']
  const trainingOptions = ['LST', 'Topping', 'SCROG']

  // Toggle pest selection
  const togglePest = (pest: string) => {
    const current = form.pests || []
    setField('pests', current.includes(pest)
      ? current.filter(p => p !== pest)
      : [...current, pest])
  }

  // Toggle training technique selection
  const toggleTraining = (training: string) => {
    const current = form.trainingTags || []
    setField('trainingTags', current.includes(training)
      ? current.filter(t => t !== training)
      : [...current, training])
  }

  // Return logic and state for the step
  return {
    backgroundColor,
    tint,
    textColor,
    waterMenu,
    setWaterMenu,
    wateringOptions,
    pestOptions,
    trainingOptions,
    setField,
    togglePest,
    toggleTraining
  }
}
