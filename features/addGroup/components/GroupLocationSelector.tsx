import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';
import { PlantItem } from '../api/fetchPlants';

interface GroupLocationSelectorProps {
  plants: PlantItem[];
  groupLocationPlantId?: string | null;
  onSelectGroupLocationPlantId?: (id: string) => void;
}

const GroupLocationSelector: React.FC<GroupLocationSelectorProps> = ({ plants, groupLocationPlantId, onSelectGroupLocationPlantId }) => {
  const t = useAppTheme();
  const styles = makeStyles(t);
  if (plants.length === 0) {
    return <Text style={{ color: t.muted }}>No selected plant has a location.</Text>;
  }
  return (
    <>
      {plants.map((p, idx) => {
        const nickname = p.locationNickname && p.locationNickname.trim() ? p.locationNickname : 'Unnamed location';
        const isSelected = groupLocationPlantId === p.id;
        return (
          <TouchableOpacity
            key={p.id}
            style={[
              styles.locationRadioRow,
              isSelected && styles.locationRadioRowSelected,
              idx !== plants.length - 1 && { marginBottom: 10 },
            ]}
            activeOpacity={0.7}
            onPress={() => onSelectGroupLocationPlantId && onSelectGroupLocationPlantId(p.id)}
          >
            <View style={[
              styles.radioOuter,
              isSelected && styles.radioOuterSelected,
            ]}>
              {isSelected && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.locationRadioText}>{`${p.name} (${nickname})`}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );
};

const makeStyles = (t: ReturnType<typeof useAppTheme>) => StyleSheet.create({
  locationRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minHeight: 44,
    paddingVertical: 10,
    marginBottom: 16,
  },
  locationRadioRowSelected: {
    backgroundColor: t.elevated,
  },
  locationRadioText: {
    color: t.text,
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '500',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: t.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.surface,
  },
  radioOuterSelected: {
    borderColor: t.accent,
    backgroundColor: t.surface,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.accent,
  },
});

export default GroupLocationSelector;
