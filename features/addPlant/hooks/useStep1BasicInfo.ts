// features/addPlant/hooks/useStep1BasicInfo.ts
// This hook manages the logic for the Basic Info step in the Add Plant flow.
// It handles strain selection, filtering, and validation for the basic info form step.

import { useState, useMemo, useCallback } from 'react';
import { getAvailableStrains } from '../api/basicInfoApi';
import type { PlantForm, PlantFieldSetter } from '@/features/plants/form/PlantForm';
import { BaseStepLogic } from '../types/StepLogic';
import { useStepBackground } from './useStepBackground';

// Interface for the logic returned by this hook
export interface Step1BasicInfoLogic extends BaseStepLogic {
  strainMenuVisible: boolean;
  openStrainMenu: () => void;
  closeStrainMenu: () => void;
  strainSearch: string;
  setStrainSearch: (value: string) => void;
  filteredStrains: string[];
  isValid: boolean;
  setField: PlantFieldSetter;
}

// Hook for managing the Basic Info step logic
export function useStep1BasicInfo(
  form: PlantForm,
  setField: PlantFieldSetter
): Step1BasicInfoLogic {
  const backgroundColor = useStepBackground();
  const strains = useMemo(() => getAvailableStrains(), []);
  const [strainMenuVisible, setStrainMenuVisible] = useState(false);
  const [strainSearch, setStrainSearch] = useState('');

  // Filter strains by search input
  const filteredStrains = useMemo(
    () => strains.filter(s => s.toLowerCase().includes(strainSearch.toLowerCase())),
    [strains, strainSearch]
  );

  // Validation: name required, age required for certain growth stages
  const isValid = useMemo(() => {
    const nameOk = form.name.trim().length > 0;
    const needAge = form.growthStage === 'vegetative' || form.growthStage === 'flowering';
    const ageOk = needAge ? form.ageDays.trim().length > 0 : true;
    return nameOk && ageOk;
  }, [form.name, form.growthStage, form.ageDays]);

  // Open/close strain dropdown menu
  const openStrainMenu = useCallback(() => setStrainMenuVisible(true), []);
  const closeStrainMenu = useCallback(() => {
    setStrainMenuVisible(false);
    setStrainSearch('');
  }, []);

  const stableSetField = useCallback(setField, [setField]);

  // Return logic and state for the step
  return {
    backgroundColor,
    strainMenuVisible,
    openStrainMenu,
    closeStrainMenu,
    strainSearch,
    setStrainSearch,
    filteredStrains,
    isValid,
    setField: stableSetField,
  };
}
