import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Plant } from '@/firestoreModels';
import { GrowPress } from '@/ui/GrowMotion';
import { growthPhaseProgress, phaseWindowLabel, phaseWindow } from '@/lib/plants/growthPhase';
import { guideStage } from '../growthStagePresentation';
import type { PlantTheme } from './plantDetailTheme';
import GrowthPhaseProgress from './GrowthPhaseProgress';

/** A quiet timeline estimate; the user always confirms physical phase changes. */
export default function GrowthStageSummary({ plant, theme: t, onPress, now = new Date() }: { plant: Plant; theme: PlantTheme; onPress(): void; now?: Date }) {
  const progress = growthPhaseProgress(plant, now);
  const stage = guideStage(progress.phase);
  const weeks = Math.round(progress.age / 7 * 10) / 10;
  const age = `${weeks} ${weeks === 1 ? 'week' : 'weeks'} · ${progress.age} ${progress.age === 1 ? 'day' : 'days'} old`;
  return <GrowPress accessibilityRole="button" accessibilityLabel={`Open stage guide. Current phase: ${stage.title}. ${age}${progress.estimated ? ', estimated' : ''}.${progress.attention ? ' Phase review suggested.' : ''}`} accessibilityHint="Explore all growth phases and update the current phase." onPress={onPress} style={{ backgroundColor: t.surface, borderRadius: 20, padding: 16, gap: 13, marginBottom: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={stage.icon} size={21} color={t.accent} accessible={false} /></View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.muted, fontSize: 10, letterSpacing: 1.2 }}>GROWTH PHASE</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: '600' }}>{stage.title}</Text>
          {!!phaseWindowLabel(progress.phase) && <View style={{ backgroundColor: t.elevated, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 }}>
            <Text accessibilityLabel={`${stage.title} period: ${phaseWindowLabel(progress.phase)}`} style={{ color: t.muted, fontSize: 10, fontWeight: '600' }}>{phaseWindowLabel(progress.phase)}</Text>
          </View>}
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={21} color={t.muted} accessible={false} />
    </View>
    <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{progress.estimated ? '≈ ' : ''}{age}</Text>
    <GrowthPhaseProgress plant={plant} theme={t} now={now} />
    {progress.attention && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><MaterialCommunityIcons name="alert-circle-outline" size={15} color={t.warm} accessible={false} /><Text style={{ color: t.warm, fontSize: 12 }}>Check for {phaseWindow(progress.next || '')?.label || 'the next phase'}</Text></View>}
  </GrowPress>;
}
