// Step0SelectStage.tsx
// This screen renders the initial step of the Add Plant flow: selecting the plant's growth stage.
// It displays selectable cards for each stage and navigation buttons for the flow.

import React, { memo, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/ui/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import HomeBackground from '@/features/home/components/HomeBackground';

const PLANT_STAGES: { key: string; label: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'germination', label: 'Germination', icon: 'seed' },
  { key: 'seedling', label: 'Seedling', icon: 'sprout' },
  { key: 'vegetative', label: 'Vegetative', icon: 'leaf' },
  { key: 'flowering', label: 'Flowering', icon: 'flower' },
  { key: 'clone', label: 'Clone', icon: 'content-duplicate' },
];

interface PlantStageCardProps {
  stage: (typeof PLANT_STAGES)[number];
  isSelected: boolean;
  onSelect: (stageKey: string) => void;
}

const PlantStageCard = memo(function PlantStageCard({ stage, isSelected, onSelect }: PlantStageCardProps) {
  const handlePress = useCallback(() => onSelect(stage.key), [onSelect, stage.key]);
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.cardSelected]}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`Select ${stage.label} stage`}
    >
      <MaterialCommunityIcons name={stage.icon} size={36} color={isSelected ? '#fff' : '#8bc34a'} />
      <ThemedText style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
        {stage.label}
      </ThemedText>
    </TouchableOpacity>
  );
});

interface Step0SelectStageProps {
  selectedStage: string | null;
  onSelectStage: (stage: string) => void;
  next: () => void;
  back: () => void;
}

function Step0SelectStage({ selectedStage, onSelectStage, next, back }: Step0SelectStageProps) {
  const handleNext = useCallback(() => {
    if (selectedStage) next();
  }, [selectedStage, next]);

  return (
    <View style={styles.container}>
      <HomeBackground />
      <ThemedText style={styles.title}>Select Plant Stage</ThemedText>
      <View style={styles.cardRow}>
        {PLANT_STAGES.map((stage) => (
          <PlantStageCard
            key={stage.key}
            stage={stage}
            isSelected={selectedStage === stage.key}
            onSelect={onSelectStage}
          />
        ))}
      </View>
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.button, styles.backButton]} onPress={back} accessibilityRole="button">
          <ThemedText style={styles.buttonText}>Back</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !selectedStage && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!selectedStage}
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedStage }}
        >
          <ThemedText style={styles.buttonText}>Next</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default memo(Step0SelectStage);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#181f1b',
    padding: 24,
    position: 'relative',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 32,
    letterSpacing: 1,
  },
  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 18,
  },
  card: {
    width: 110,
    height: 130,
    backgroundColor: '#232a25',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    backgroundColor: '#4caf50',
    borderColor: '#8bc34a',
  },
  cardLabel: {
    marginTop: 12,
    color: '#8bc34a',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  cardLabelSelected: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 32,
    paddingHorizontal: 8,
  },
  button: {
    backgroundColor: '#4caf50',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
    marginHorizontal: 8,
    minWidth: 100,
  },
  backButton: {
    backgroundColor: '#232a25',
    borderWidth: 1,
    borderColor: '#8bc34a',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonDisabled: {
    backgroundColor: '#9e9e9e',
  },
});
