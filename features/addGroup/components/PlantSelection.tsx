import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { PlantItem } from '../api/fetchPlants';
import GroupLocationSelector from './GroupLocationSelector';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';

interface PlantSelectionProps {
  plants: PlantItem[];
  selectedPlantIds: string[];
  onTogglePlant: (id: string) => void;
  groupLocationPlantId?: string | null;
  onSelectGroupLocationPlantId?: (id: string) => void;
  // New: when provided, grey out plants that don't match this environment
  allowedEnvironment?: 'outdoor' | 'indoor' | 'greenhouse';
  // New: disable specific plant IDs (e.g., already in a group)
  disabledIds?: string[];
}

export const PlantSelection: React.FC<PlantSelectionProps> = ({ plants, selectedPlantIds, onTogglePlant, groupLocationPlantId, onSelectGroupLocationPlantId, allowedEnvironment, disabledIds = [] }) => {
  const theme = (useColorScheme() ?? 'dark') as 'light' | 'dark';

  const selectedPlants = plants.filter(p => selectedPlantIds.includes(p.id));
  const selectableLocationPlants = selectedPlants.filter(p => p.location);
  const hasOutdoor = selectedPlants.some(p => p.environment === 'outdoor');

  return (
    <View style={styles.container}>
      {plants.map((plant) => {
        const isSelected = selectedPlantIds.includes(plant.id);
        const imageUri = getRenderablePlantImageUri(plant.imageUri);
        // Prefer enforced environment if provided, else lock based on first selected plant
        const selectedEnv = allowedEnvironment ?? (selectedPlantIds.length > 0
          ? plants.find(p => p.id === selectedPlantIds[0])?.environment
          : null);
        const envMismatch = Boolean(selectedEnv && plant.environment !== selectedEnv);
        const isExplicitlyDisabled = disabledIds.includes(plant.id);
        const isDisabled = Boolean((envMismatch || isExplicitlyDisabled) && !isSelected);

        return (
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityLabel={plant.name}
            accessibilityState={{ checked: isSelected, disabled: isDisabled }}
            key={plant.id}
            onPress={() => {
              if (isDisabled) return;
              onTogglePlant(plant.id);
              if (onSelectGroupLocationPlantId && groupLocationPlantId === plant.id) {
                onSelectGroupLocationPlantId(''); // Pass empty string instead of null
              }
            }}
            style={[
              styles.card,
              isSelected && { borderColor: '#c8e78b', backgroundColor: '#30442e' },
              isDisabled && { opacity: 0.4 },
            ]}
            disabled={isDisabled}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} />
            ) : (
              <View style={[styles.image, { backgroundColor: '#3c5135', alignItems: 'center', justifyContent: 'center' }]}> 
                <MaterialCommunityIcons name="leaf" size={25} color="#c8e78b" />
              </View>
            )}
            <View style={styles.infoContainer}>
              <Text style={[styles.name, { color: Colors[theme].text }]}>{plant.name}</Text>
              <Text style={[styles.environment, { color: Colors[theme].gray }]}>
                {plant.locationNickname || plant.environment}
              </Text>
            </View>
            <MaterialCommunityIcons name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={23} color={isSelected ? '#c8e78b' : '#acbba2'} />
          </TouchableOpacity>
        );
      })}
      {/* Location selection radio list */}
      {selectedPlantIds.length >= 2 && hasOutdoor && (
        <>
          <Text style={{ fontWeight: 'bold', fontSize: 17, marginBottom: 12, color: Colors[theme].text, marginLeft: 2 }}>📍 Choose Location for Weather</Text>
          <GroupLocationSelector
            plants={selectableLocationPlants}
            groupLocationPlantId={groupLocationPlantId}
            onSelectGroupLocationPlantId={onSelectGroupLocationPlantId}
            theme={theme}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#40523b',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    backgroundColor: '#22332a',
    alignItems: 'center',
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  environment: {
    fontSize: 14,
  },
});
