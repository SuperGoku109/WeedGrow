// EnvironmentForm.tsx
// This component renders the Environment step of the Add Plant flow.
// It collects information about where and how the plant is growing (sensor profile, planted in, pot size, sunlight exposure).

import React, { memo, useRef, useState, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Button, Tooltip } from 'react-native-paper';
import { FadeIn } from 'react-native-reanimated';
import { ThemedText } from '@/ui/ThemedText';
import { WeedGrowCard } from '@/ui/WeedGrowCard';
import { WeedGrowButtonRow } from '@/ui/WeedGrowButtonRow';
import { WeedGrowDropdownInput } from '@/ui/WeedGrowDropdownInput';
import { WeedGrowFormSection } from '@/ui/WeedGrowFormSection';
import type { Step2EnvironmentLogic } from '../hooks/useStep2Environment';
import { PlantForm } from '@/features/plants/form/PlantForm';
import { AnimatedMakikoDropdownInput } from '@/components/ui/AnimatedMakikoDropdownInput';
import { AnimatedMakikoInput } from '@/components/ui/AnimatedMakikoInput';
import { AnimatedMakikoChipInput } from '@/components/ui/AnimatedMakikoChipInput';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { WeedGrowCardBackground } from '@/components/ui/WeedGrowCardBackground';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

// Props for the EnvironmentForm component
interface EnvironmentFormProps {
  form: PlantForm // Form state object
  logic: Step2EnvironmentLogic // Logic handlers for environment step
  next(): void // Callback to go to next step
  back(): void // Callback to go to previous step
}

// Section for selecting a sensor profile (for indoor/greenhouse)
const SensorProfileSection = memo(function SensorProfileSection({ logic }: { logic: Step2EnvironmentLogic }) {
  return (
    <WeedGrowFormSection label="Sensor Profile" style={styles.section}>
      <WeedGrowDropdownInput
        icon="chip"
        label={logic.loadingProfiles ? 'Loading…' : 'Sensor Profile'}
        value={logic.sensorOptions.find((o) => o.value === logic.environment)?.label || ''}
        options={logic.sensorOptions}
        onSelect={v => logic.setField('sensorProfileId', v)}
        placeholder="Select profile"
        zIndex={3000}
      />
    </WeedGrowFormSection>
  );
});

// Section for selecting if the plant is in a pot or in the ground
const PlantedInSection = memo(function PlantedInSection({ logic }: { logic: Step2EnvironmentLogic }) {
  const handleSelect = useCallback((opt: string) => logic.setField('plantedIn', opt), [logic]);
  return (
    <WeedGrowFormSection label="Planted In" style={styles.section}>
      <View style={styles.plantedInRow}>
        {['pot', 'ground'].map(opt => (
          <TouchableOpacity
            key={opt}
            style={[styles.plantedInButton, logic.plantedIn === opt && styles.plantedInButtonSelected]}
            onPress={() => handleSelect(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected: logic.plantedIn === opt }}
            accessibilityLabel={`Planted in ${opt}`}
          >
            <Text style={styles.plantedInButtonText}>{opt === 'pot' ? 'Pot' : 'Ground'}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </WeedGrowFormSection>
  );
});

// Section for selecting pot size (only if planted in a pot)
const PotSizeSection = memo(function PotSizeSection({ form, logic }: { form: PlantForm; logic: Step2EnvironmentLogic }) {
  return (
    <WeedGrowFormSection style={styles.section}>
      <AnimatedMakikoDropdownInput
        label="Pot Size"
        iconName="flower-outline"
        iconClass={MaterialCommunityIcons}
        iconColor="#4caf50"
        value={form.potSize || ''}
        options={logic.potSizeOptions.map(p => ({ label: p, value: p }))}
        onSelect={v => logic.setField('potSize', v)}
        placeholder="Select pot size"
        style={styles.dropdown}
      />
    </WeedGrowFormSection>
  );
});

// Section for selecting sunlight exposure (for outdoor/greenhouse)
const SunlightExposureSection = memo(function SunlightExposureSection({ form, logic }: { form: PlantForm; logic: Step2EnvironmentLogic }) {
  return (
    <WeedGrowFormSection style={styles.section}>
      <AnimatedMakikoDropdownInput
        label="Sunlight Exposure"
        iconName="white-balance-sunny"
        iconClass={MaterialCommunityIcons}
        iconColor="#4caf50"
        value={form.sunlightExposure || ''}
        options={logic.sunlightOptions.map(opt => ({ label: opt.label, value: opt.value }))}
        onSelect={v => logic.setField('sunlightExposure', v)}
        placeholder="Select sunlight"
        style={styles.dropdown}
      />
    </WeedGrowFormSection>
  );
});

// Section for selecting soil type
const soilTypeOptions = [
  { label: 'Native soil (garden)', value: 'native' },
  { label: 'Raised bed soil', value: 'raised' },
  { label: 'Store-bought potting soil', value: 'store' },
  { label: 'Custom mix', value: 'custom' },
];

const SoilTypeSection = memo(function SoilTypeSection({ form, logic }: { form: PlantForm; logic: Step2EnvironmentLogic }) {
  return (
    <WeedGrowFormSection style={styles.section}>
      <AnimatedMakikoDropdownInput
        label="Soil Type"
        iconName="shovel"
        iconClass={MaterialCommunityIcons}
        iconColor="#4caf50"
        value={form.soilType || ''}
        options={soilTypeOptions}
        onSelect={v => logic.setField('soilType', v)}
        placeholder="Select soil type"
        style={styles.dropdown}
      />
    </WeedGrowFormSection>
  );
});

// Advanced options for Permanent Protection
const protectionOptions = [
  { label: 'Cage', value: 'cage' },
  { label: 'Netting', value: 'netting' },
  { label: 'Row cover', value: 'row_cover' },
  { label: 'Animal fence', value: 'animal_fence' },
  { label: 'None', value: 'none' },
  { label: 'Other', value: 'other' },
];

// Common companion planting options
const companionOptions = [
  'Basil', 'Marigold', 'Clover', 'Mint', 'Chives', 'None', 'Other'
];

// Advanced Setup Section
const AdvancedSetupSection = memo(function AdvancedSetupSection({ form, logic, scrollRef }: { form: PlantForm; logic: Step2EnvironmentLogic; scrollRef?: React.RefObject<KeyboardAwareScrollView | null> }) {
  const [expanded, setExpanded] = useState(false);
  const companions = form.companionPlants || [];

  const dropdownInputRef = useRef(null);

  return (
    <View style={styles.advancedSection}>
      <TouchableOpacity
        onPress={() => setExpanded(v => !v)}
        style={[styles.advancedToggle, expanded && styles.advancedToggleExpanded]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide Advanced Setup' : 'Show Advanced Setup'}
      >
        <Text style={styles.advancedToggleText}>
          {expanded ? 'Hide Advanced Setup' : 'Optional Advanced Setup'}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <>
          <View style={styles.advancedRow}>
            <AnimatedMakikoInput
              label="Soil pH"
              iconName="flask"
              iconClass={MaterialCommunityIcons}
              iconColor="#4caf50"
              value={form.soilPh || ''}
              onChangeText={val => logic.setField('soilPh', val)}
              keyboardType="numeric"
              inputStyle={styles.soilPhInput}
            />
            <Tooltip title="Only set if known — helps with nutrient advice">
              <MaterialCommunityIcons name="information-outline" size={22} color="#aaa" />
            </Tooltip>
          </View>
          <AnimatedMakikoDropdownInput
            ref={dropdownInputRef}
            label="Permanent Protection"
            iconName="shield"
            iconClass={MaterialCommunityIcons}
            iconColor="#4caf50"
            value={form.permanentProtection || ''}
            options={protectionOptions}
            onSelect={v => logic.setField('permanentProtection', v)}
            placeholder="Select protection"
            style={styles.dropdown}
            onFocusInput={() => {
              if (scrollRef && scrollRef.current && dropdownInputRef.current) {
                scrollRef.current.scrollToFocusedInput(dropdownInputRef.current);
              }
            }}
          />
          <AnimatedMakikoChipInput
            label="Companion Plants"
            iconName="leaf"
            iconClass={MaterialCommunityIcons}
            iconColor="#4caf50"
            value={companions}
            onChange={chips => logic.setField('companionPlants', chips)}
            suggestions={companionOptions}
            style={styles.chipInput}
          />
        </>
      )}
    </View>
  );
});

// Main form component for entering environment details
export const EnvironmentForm = memo(function EnvironmentForm({ form, logic, next, back }: EnvironmentFormProps) {
  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  return (
    <WeedGrowCard style={styles.card} entering={FadeIn.duration(500)}>
      <WeedGrowCardBackground>
        <View style={styles.flex1}>
          <KeyboardAwareScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            enableOnAndroid
            extraScrollHeight={120}
            keyboardShouldPersistTaps="handled"
            keyboardOpeningTime={0}
          >
            <View style={styles.innerContent}>
              {/* Title */}
              <ThemedText type="title" style={styles.title}>
                🌿 Where is your plant growing?
              </ThemedText>

              {/* Show sensor profile if indoor or greenhouse */}
              {(logic.environment === 'indoor' || logic.environment === 'greenhouse') && (
                <SensorProfileSection logic={logic} />
              )}

              {/* Planted in pot or ground */}
              <PlantedInSection logic={logic} />

              {/* Show pot size if planted in a pot */}
              {logic.plantedIn === 'pot' && <PotSizeSection form={form} logic={logic} />}

              {/* Show sunlight exposure if outdoor or greenhouse */}
              {(logic.environment === 'outdoor' || logic.environment === 'greenhouse') && (
                <>
                  <SunlightExposureSection form={form} logic={logic} />
                  <SoilTypeSection form={form} logic={logic} />
                  <AdvancedSetupSection form={form} logic={logic} scrollRef={scrollRef} />
                </>
              )}

              {/* Navigation buttons: Back and Next */}
              <WeedGrowButtonRow>
                <Button onPress={back} mode="outlined" style={styles.button}>
                  Back
                </Button>
                <Button onPress={next} mode="contained" style={styles.button}>
                  Next
                </Button>
              </WeedGrowButtonRow>
            </View>
          </KeyboardAwareScrollView>
        </View>
      </WeedGrowCardBackground>
    </WeedGrowCard>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
    padding: 0,
  },
  flex1: { flex: 1, position: 'relative' },
  scrollContent: { position: 'relative', zIndex: 1 },
  innerContent: { padding: 16, gap: 16 },
  title: { textAlign: 'center', fontSize: 24 },
  section: { marginBottom: 16 },
  dropdown: { marginBottom: 0 },
  plantedInRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  plantedInButton: {
    flex: 1,
    margin: 4,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#232a25',
    alignItems: 'center',
  },
  plantedInButtonSelected: {
    backgroundColor: '#4CAF50',
  },
  plantedInButtonText: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  advancedSection: { marginTop: 8 },
  advancedToggle: {
    backgroundColor: '#355c3a',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 0,
  },
  advancedToggleExpanded: { marginBottom: 12 },
  advancedToggleText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  advancedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  soilPhInput: { width: 120 },
  chipInput: { marginBottom: 16 },
  button: { flex: 1, marginRight: 8 },
});
