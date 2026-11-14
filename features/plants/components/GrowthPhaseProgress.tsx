import React from 'react';
import { Text, View } from 'react-native';
import type { Plant } from '@/firestoreModels';
import { growthPhaseProgress } from '@/lib/plants/growthPhase';
import { growthStageColor } from '../growthStagePresentation';
import type { PlantTheme } from './plantDetailTheme';

export default function GrowthPhaseProgress({ plant, theme: t, now = new Date() }: { plant: Plant; theme: PlantTheme; now?: Date }) {
  const progress = growthPhaseProgress(plant, now);
  const stageColor = growthStageColor(progress.phase, t.background);
  if (progress.fraction == null || progress.phaseDay == null || progress.phaseDays == null) return null;
  const current = progress.phaseDay;
  const percent = Math.max(4, Math.min(100, Math.round(current / progress.phaseDays * 100)));
  const label = `${current} / ${progress.phaseDays} days`;
  return <View style={{ gap: 9 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <Text style={{ color: t.muted, fontSize: 12 }}>Phase progress</Text>
      <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{progress.estimated ? '≈ ' : ''}{current}<Text style={{ color: t.muted, fontWeight: '400' }}> / {progress.phaseDays} days</Text></Text>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel={`Phase progress: ${label}${progress.estimated ? ', estimated' : ''}${progress.attention ? '. Review phase' : ''}`} accessibilityValue={{ min: 0, max: progress.phaseDays, now: Math.min(current, progress.phaseDays), text: label }} style={{ height: 18, padding: 3, backgroundColor: t.elevated, borderRadius: 10, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${percent}%`, backgroundColor: stageColor, borderRadius: 7 }} />
    </View>
  </View>;
}
