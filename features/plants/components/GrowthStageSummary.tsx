import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Plant } from '@/firestoreModels';
import { GrowPress } from '@/ui/GrowMotion';
import { daysInStage, stageSuggestion, stageReminderSuggestion } from '@/lib/plants/growthTracking';
import { stageTiming } from '@/lib/plants/stageAgeDefaults';
import { plantDay } from '@/lib/dates/plantDay';
import { growthDate, growthDuration, guideStage } from '../growthStagePresentation';
import type { PlantTheme } from './plantDetailTheme';

/** A single read-only entry point. Management and guide content live on the stage screen. */
export default function GrowthStageSummary({ plant, theme: t, onPress, now = new Date() }: { plant: Plant; theme: PlantTheme; onPress(): void; now?: Date }) {
  const stage = guideStage(plant.growthStage);
  const duration = growthDuration(stage.key);
  const elapsed = daysInStage(plant, now);
  const timing = stageTiming(plant, now);
  const today = plantDay(now, plant.locationTimeZone);
  const due = stageSuggestion(plant, now);
  const checkIn = !!due && !['profile', 'location'].includes(due.kind);
  const next = [stageSuggestion(plant, now, true), plant.growthStage === 'flowering' ? stageReminderSuggestion(plant, now) : null]
    .filter(item => item && item.checkOn > today).sort((a, b) => a!.checkOn.localeCompare(b!.checkOn))[0];
  return <GrowPress accessibilityRole="button" accessibilityLabel={`Explore growth stages. Current stage: ${stage.title}. ${elapsed} days${timing.estimated ? ', estimated' : ''}.`} accessibilityHint="Opens the stage overview and guide." onPress={onPress}
    style={{ backgroundColor: t.surface, borderRadius: 22, padding: 20, gap: 20, marginBottom: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={stage.icon} size={24} color={t.accent} accessible={false} /></View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ color: t.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.6 }}>GROWTH STAGE</Text><Text style={{ color: t.text, fontSize: 24, fontWeight: '600', letterSpacing: -.5 }}>{stage.title}</Text></View>
      <MaterialCommunityIcons name="arrow-top-right" size={21} color={t.muted} accessible={false} />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
      <View style={{ flex: 1, minWidth: 0, gap: 7, paddingRight: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}><Text style={{ color: t.text, fontSize: 28, fontWeight: '500', letterSpacing: -.7 }}>{elapsed}</Text>
          {timing.estimated && <View style={{ backgroundColor: t.elevated, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 }}><Text style={{ color: t.muted, fontSize: 10 }}>Estimate</Text></View>}
        </View>
        <Text style={{ color: t.muted, fontSize: 12 }}>{plant.growthStage === 'harvested' ? 'days since harvest' : plant.growthStage === 'completed' ? 'days since completion' : 'days in this stage'}</Text>
      </View>
      <View style={{ width: 1, backgroundColor: t.elevated }} />
      <View style={{ flex: 1, minWidth: 0, gap: 7, paddingLeft: 18, justifyContent: 'center' }}>
        <Text style={{ color: t.text, fontSize: duration ? 26 : 19, fontWeight: '500', letterSpacing: -.7 }}>{duration?.value || (plant.growthStage === 'harvested' || plant.growthStage === 'completed' ? 'Finished' : '—')}</Text>
        <Text style={{ color: t.muted, fontSize: 12 }}>{duration ? `${duration.unit} · duration guide` : 'living growth'}</Text>
      </View>
    </View>
    {(checkIn || next) && <View style={{ borderTopWidth: 1, borderColor: t.elevated, paddingTop: 13, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      {checkIn && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.warm }} />}
      <Text style={{ color: checkIn ? t.warm : t.muted, fontSize: 12, flex: 1 }}>{checkIn ? 'Stage check-in available' : next ? `Next check · ${growthDate(next.checkOn, false)}` : ''}</Text>
    </View>}
  </GrowPress>;
}
