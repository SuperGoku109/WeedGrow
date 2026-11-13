import React from 'react';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppNotice from '@/ui/AppNotice';
import { GrowPress, GrowReveal } from '@/ui/GrowMotion';
import LoadError from '@/ui/LoadError';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { plantDay } from '@/lib/dates/plantDay';
import { stageTiming } from '@/lib/plants/stageAgeDefaults';
import { usePlant } from '../hooks/usePlant';
import { guideStage, growthDate, growthDuration, GUIDE_PLACEHOLDERS, type GrowthGuideStage } from '../growthStagePresentation';
import { plantThemes } from '../components/plantDetailTheme';
import LoadingView from '../components/LoadingView';
import NotFoundView from '../components/NotFoundView';
import GrowthPhaseSheet from '../components/GrowthPhaseSheet';
import { growthPhase, growthPhaseProgress, phaseWindowLabel, phaseDayWindowLabel } from '@/lib/plants/growthPhase';
import GrowthStageTimeline from '../components/GrowthStageTimeline';
import GrowthPhaseProgress from '../components/GrowthPhaseProgress';
import PlantActionButton from '../components/PlantActionButton';

export default function GrowthStageScreen() {
  const params = useLocalSearchParams<{ id: string; theme?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { plant, loading, error, refresh } = usePlant(id);
  const t = params.theme === 'daylight' ? plantThemes.daylight : plantThemes.grove;
  const now = useMinuteClock();
  const [chosen, setChosen] = React.useState<GrowthGuideStage | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const back = React.useCallback(() => { if (reviewBusy) return; if (reviewOpen) { setReviewOpen(false); return; } if (router.canGoBack()) router.back(); else router.replace({ pathname: '/plant/[id]', params: { id } }); }, [router, id, reviewOpen, reviewBusy]);
  useFocusEffect(React.useCallback(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => listener.remove(); }, [back]));
  React.useEffect(() => { setChosen(null); setReviewOpen(false); }, [id]);
  if (loading) return <LoadingView onBack={back} />;
  if (!plant && error) return <LoadError message={error} onRetry={refresh} onBack={back} />;
  if (!plant) return <NotFoundView />;
  const current = guideStage(growthPhase(plant));
  const selected = guideStage(chosen || current.key);
  const isCurrent = selected.key === current.key;
  const duration = growthDuration(selected.key);
  const baseTiming = stageTiming(plant, now);
  const timing = current.key === 'late_flowering' && plant.lateFloweringStartedOn
    ? { ...baseTiming, startedOn: plant.lateFloweringStartedOn, estimated: false }
    : baseTiming;
  const today = plantDay(now, plant.locationTimeZone);
  const progress = growthPhaseProgress(plant, now);
  const due = progress.attention ? { kind: 'transition', prompt: 'This phase is nearing the end of its timing guide. Review what you see before confirming the next phase.' } : null;
  const next = progress.checkOn && progress.checkOn > today ? { checkOn: progress.checkOn } : null;
  const mutable = !plant.deleting && ['active', 'harvested'].includes(plant.status);
  const select = (key: GrowthGuideStage) => setChosen(key);
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: t.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}>
      <GrowPress accessibilityRole="button" accessibilityLabel="Back to plant" disabled={reviewBusy} onPress={back} style={{ minHeight: 40, minWidth: 40, justifyContent: 'center' }}><MaterialCommunityIcons name="arrow-left" size={22} color={t.text} /></GrowPress>
      <View style={{ flex: 1 }}><Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{plant.name}</Text><Text style={{ color: t.muted, fontSize: 12, marginTop: 3 }}>Stage guide</Text></View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 28, gap: 26 }}>
      <GrowthStageTimeline plant={plant} selectedStage={selected.key} onSelect={select} theme={t} />
      <GrowReveal key={selected.key} style={{ gap: 26 }}>
      <View style={{ gap: 16, padding: 16, backgroundColor: t.surface, borderRadius: 20 }}>
        <View style={{ gap: 7 }}>
          <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>Timing</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8, rowGap: 3 }}>
            <Text style={{ color: t.text, fontSize: 13, fontWeight: '500' }}>{phaseWindowLabel(selected.key) || duration?.value || (selected.key === 'completed' ? 'Finished' : '—')}</Text>
            {!!phaseDayWindowLabel(selected.key) && <Text style={{ color: t.muted, fontSize: 12 }}>· {phaseDayWindowLabel(selected.key)}</Text>}
            {!phaseWindowLabel(selected.key) && duration && <Text style={{ color: t.muted, fontSize: 12 }}>({duration.unit})</Text>}
          </View>
        </View>
        {isCurrent && <GrowthPhaseProgress plant={plant} theme={t} now={now} />}
        {isCurrent ? <View style={{ borderTopWidth: 1, borderColor: t.elevated, paddingTop: 12, flexDirection: 'row' }}>
          <View style={{ flex: 1, gap: 5, paddingRight: 12 }}><Text style={{ color: t.muted, fontSize: 11 }}>Started{timing.estimated ? ' · estimated' : ''}</Text><Text style={{ color: t.text, fontSize: 13, fontWeight: '500' }}>{growthDate(timing.startedOn)}</Text></View>
          <View style={{ flex: 1, gap: 5, paddingLeft: 12, borderLeftWidth: 1, borderColor: t.elevated }}><Text style={{ color: t.muted, fontSize: 11 }}>Next check-in</Text><Text style={{ color: due ? t.warm : t.text, fontSize: 13, fontWeight: '500' }}>{due ? 'Ready to review' : next ? growthDate(next.checkOn) : 'Based on plant signs'}</Text></View>
        </View> : <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>{selected.key === 'preflower' ? 'A transition within vegetative growth. It does not replace the confirmed plant stage.' : 'Browsing the guide doesn’t change your plant’s recorded stage.'}</Text>}
      </View>
      {isCurrent && plant.growthStage === 'vegetative' && plant.preflowerObservedOn && <Text style={{ color: t.muted, lineHeight: 21 }}>Early flowering signs recorded · {growthDate(plant.preflowerObservedOn)}</Text>}
      <View style={{ padding: 20, backgroundColor: t.surface, borderRadius: 22, gap: 20 }}>
      <View style={{ gap: 8 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '600' }}>Guide preview</Text><Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>Detailed guidance will be added here. These sections are placeholders.</Text></View>
      {GUIDE_PLACEHOLDERS.map(section => <View key={section.title} style={{ gap: 13, paddingTop: 18, borderTopWidth: 1, borderColor: t.elevated }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><MaterialCommunityIcons name={section.icon} size={20} color={t.muted} /><Text style={{ color: t.text, fontSize: 16, fontWeight: '500' }}>{section.title}</Text></View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 8 }}>{[96, 100, 65].map((width, index) => <View key={index} style={{ width: `${width}%`, height: 7, borderRadius: 4, backgroundColor: t.elevated }} />)}</View>
        <Text style={{ color: t.muted, fontSize: 12, lineHeight: 19 }}>{section.note}</Text>
      </View>)}
      </View>
      </GrowReveal>
    </ScrollView>
    {(mutable || !isCurrent) && <View style={{ borderTopWidth: 1, borderColor: t.elevated, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}><View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}><PlantActionButton label={!isCurrent ? 'Back to current stage' : due ? ['profile', 'location'].includes(due.kind) ? 'Set up stage checks' : 'Review stage' : 'Update stage'} icon={!isCurrent ? 'arrow-left' : 'sprout-outline'} theme={t} primary={isCurrent} onPress={() => isCurrent ? setReviewOpen(true) : select(current.key)} /></View></View>}
    {reviewOpen && <GrowthPhaseSheet plantId={id} plant={plant} theme={t} onBusyChange={setReviewBusy} onClose={() => setReviewOpen(false)} onSaved={value => { setMessage(value); setReviewOpen(false); setChosen(null); }} />}
    <AppNotice visible={!!message} onDismiss={() => setMessage('')} duration={4500}>{message}</AppNotice>
  </SafeAreaView>;
}
