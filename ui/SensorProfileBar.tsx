import React from 'react';
import { useSensorProfile } from '@/hooks/useSensorProfile';
import Feedback from './Feedback';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/ui/ThemedText';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SensorProfileBarProps {
  sensorProfileId: string;
}

export default function SensorProfileBar({ sensorProfileId }: SensorProfileBarProps) {
  const { data: profile, loading, error, refresh } = useSensorProfile(sensorProfileId);
  if (loading && !profile) return <Feedback tone="loading" message="Loading sensor data…" />;
  if (error) return <Feedback tone="error" message={error} onRetry={refresh} />;
  if (!profile) return <ThemedText>No sensor profile linked</ThemedText>;

  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name="thermometer" color="#fff" size={18} />
      <ThemedText style={styles.stat}>{profile.defaultTemp ?? '--'}°C</ThemedText>
      <MaterialCommunityIcons name="water-percent" color="#fff" size={18} />
      <ThemedText style={styles.stat}>{profile.defaultHumidity ?? '--'}%</ThemedText>
      <ThemedText style={styles.stat}>
        {profile.name ? `Sensor: ${profile.name}` : null}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  stat: {
    color: '#fff',
    fontSize: 14,
    marginRight: 8,
  },
});
