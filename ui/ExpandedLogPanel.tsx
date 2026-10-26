import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ThemedText } from './ThemedText';
import type { PlantLog } from '@/firestoreModels';

export interface ExpandedLogPanelProps {
  date: string;
  weather?: {
    weatherSummary?: string;
    minTemp?: number | null;
    maxTemp?: number | null;
    humidity?: number | null;
    rain?: number | null;
  };
  logs: { type: string; description?: string; updatedBy?: string; timestamp?: PlantLog['timestamp'] | null }[];
  onAddLog: () => void;
  onAddPic: () => void;
}

export default function ExpandedLogPanel({ date, weather, logs, onAddLog, onAddPic }: ExpandedLogPanelProps) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, margin: 8, padding: 14, shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
      <ThemedText style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 6 }}>Logs for {date}</ThemedText>
      {/* Weather details */}
      {weather && (
        <View style={{ marginBottom: 10 }}>
          <ThemedText style={{ fontWeight: '600', marginBottom: 2 }}>Weather</ThemedText>
          <ThemedText style={{ color: '#2563eb' }}>{weather.weatherSummary || 'No summary'}</ThemedText>
          <Text style={{ color: '#444', fontSize: 13 }}>
            🌡️ {weather.minTemp}° / {weather.maxTemp}°  |  💧 {weather.humidity}%  |  ☔ {weather.rain}mm
          </Text>
        </View>
      )}
      {/* Logs summary */}
      <View style={{ marginBottom: 10 }}>
        <ThemedText style={{ fontWeight: '600', marginBottom: 2 }}>Logs</ThemedText>
        {logs.length === 0 ? (
          <ThemedText style={{ color: '#888' }}>No logs for this day.</ThemedText>
        ) : (
          logs.map((log, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <Text style={{ fontSize: 15, marginRight: 6 }}>
                {log.type === 'watering' ? '💧' : log.type === 'fertilizing' ? '🧪' : log.type === 'pest' ? '🪲' : log.type === 'health' ? '❤️' : '📝'}
              </Text>
              <Text style={{ color: '#444', fontSize: 13 }}>{log.description || log.type}</Text>
              {log.updatedBy && <Text style={{ color: '#aaa', fontSize: 11, marginLeft: 6 }}>by {log.updatedBy}</Text>}
            </View>
          ))
        )}
      </View>
      {/* Action buttons */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <TouchableOpacity onPress={onAddLog} style={{ backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Log</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onAddPic} style={{ backgroundColor: '#00c853', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add Progress Pic</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
