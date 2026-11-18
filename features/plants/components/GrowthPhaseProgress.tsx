import React from 'react';
import { Text, View } from 'react-native';
import type { Plant } from '@/firestoreModels';
import { growthPhaseProgress } from '@/lib/plants/growthPhase';
import { growthStageColor } from '../growthStagePresentation';
import type { PlantTheme } from './plantDetailTheme';

export default function GrowthPhaseProgress({ plant, theme: t, now = new Date(), compact = false }: { plant: Plant; theme: PlantTheme; now?: Date; compact?: boolean }) {
  const progress = growthPhaseProgress(plant, now);
  const stageColor = growthStageColor(progress.phase, t.background);
  if (progress.fraction == null || progress.phaseDay == null || progress.phaseDays == null) return null;
  const current = progress.phaseDay;
  const percent = Math.round(progress.fraction * 100);
  const label = `${current} / ${progress.phaseDays} days`;
  return <View style={{ gap: compact ? 5 : 9 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <Text style={{ color: t.muted, fontSize: 12 }}>
        {compact && progress.estimated ? 'Estimated phase progress' : 'Phase progress'}
      </Text>
      {!compact && <Text style={{ color: t.text, fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
        {progress.estimated ? '≈ ' : ''}{label}
      </Text>}
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel={`Phase progress${progress.estimated ? ', estimated' : ''}`} accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ height: compact ? 5 : 10, backgroundColor: t.elevated, borderRadius: 10, overflow: 'hidden' }}>
      <View style={{ height: '100%', width: `${percent}%`, backgroundColor: stageColor, borderRadius: 7 }} />
    </View>
  </View>;
}
