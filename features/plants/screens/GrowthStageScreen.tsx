import React from 'react';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar } from 'react-native-paper';
import { GrowPress } from '@/ui/GrowMotion';
import LoadError from '@/ui/LoadError';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { plantDay } from '@/lib/dates/plantDay';
import { daysInStage, stageSuggestion, stageReminderSuggestion } from '@/lib/plants/growthTracking';
import { stageTiming } from '@/lib/plants/stageAgeDefaults';
import { usePlant } from '../hooks/usePlant';
import { guideStage, guideTabs, growthDate, growthDuration, GUIDE_PLACEHOLDERS, type GrowthGuideStage } from '../growthStagePresentation';
import { plantThemes } from '../components/plantDetailTheme';
import LoadingView from '../components/LoadingView';
import NotFoundView from '../components/NotFoundView';
import PlantEditorSheet from '../components/PlantEditorSheet';
import GrowthStageCard from '../components/GrowthStageCard';
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
  const tabsRef = React.useRef<ScrollView>(null);
  const offsets = React.useRef<Record<string, number>>({});
  const back = React.useCallback(() => { if (reviewBusy) return; if (reviewOpen) { setReviewOpen(false); return; } if (router.canGoBack()) router.back(); else router.replace({ pathname: '/plant/[id]', params: { id } }); }, [router, id, reviewOpen, reviewBusy]);
  useFocusEffect(React.useCallback(() => { const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; }); return () => listener.remove(); }, [back]));
  React.useEffect(() => { setChosen(null); setReviewOpen(false); }, [id]);
  if (loading) return <LoadingView onBack={back} />;
  if (!plant && error) return <LoadError message={error} onRetry={refresh} onBack={back} />;
  if (!plant) return <NotFoundView />;
  const current = guideStage(plant.growthStage);
  const selected = guideStage(chosen || current.key);
  const isCurrent = selected.key === current.key;
  const duration = growthDuration(selected.key);
  const timing = stageTiming(plant, now);
  const elapsed = daysInStage(plant, now);
  const today = plantDay(now, plant.locationTimeZone);
  const due = stageSuggestion(plant, now);
  const next = [stageSuggestion(plant, now, true), plant.growthStage === 'flowering' ? stageReminderSuggestion(plant, now) : null]
    .filter(item => item && item.checkOn > today).sort((a, b) => a!.checkOn.localeCompare(b!.checkOn))[0];
  const mutable = !plant.deleting && ['active', 'harvested'].includes(plant.status);
  const select = (key: GrowthGuideStage) => { setChosen(key); tabsRef.current?.scrollTo({ x: Math.max(0, (offsets.current[key] || 0) - 20), animated: false }); };
  const edit = () => { setReviewOpen(false); router.push({ pathname: '/plant/[id]/edit', params: { id, theme: params.theme || 'grove' } }); };
  const harvest = () => { setReviewOpen(false); router.push({ pathname: '/plant/[id]', params: { id, section: 'Details', managePlant: '1' } }); };
  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: t.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 }}>
      <GrowPress accessibilityRole="button" accessibilityLabel="Back to plant" disabled={reviewBusy} onPress={back} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center' }}><MaterialCommunityIcons name="arrow-left" size={24} color={t.text} /></GrowPress>
      <View style={{ flex: 1 }}><Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{plant.name}</Text><Text style={{ color: t.muted, fontSize: 12, marginTop: 3 }}>Growth stages</Text></View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: t.elevated }}><Text style={{ color: t.muted, fontSize: 11 }}>Stage guide</Text></View>
    </View>
    <View style={{ borderBottomWidth: 1, borderColor: t.elevated }}><ScrollView horizontal ref={tabsRef} showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ paddingHorizontal: 20, gap: 24 }} onContentSizeChange={() => tabsRef.current?.scrollTo({ x: Math.max(0, (offsets.current[selected.key] || 0) - 20), animated: false })}>
      {guideTabs(plant).map(item => <View key={item.key} onLayout={event => { offsets.current[item.key] = event.nativeEvent.layout.x; }}>
        <GrowPress accessibilityRole="tab" accessibilityLabel={`${item.title}${item.key === current.key ? ', current stage' : ''}`} aria-selected={item.key === selected.key} accessibilityState={{ selected: item.key === selected.key }} onPress={() => select(item.key)} style={{ minHeight: 52, borderBottomWidth: 2, borderBottomColor: item.key === selected.key ? t.accent : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Text style={{ color: item.key === selected.key ? t.accent : t.muted, fontSize: 14, fontWeight: item.key === selected.key ? '600' : '400' }}>{item.title}</Text>
          {item.key === current.key && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.accent }} />}
        </GrowPress>
      </View>)}
    </ScrollView></View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 28, gap: 26 }}>
      <View style={{ backgroundColor: t.surface, borderRadius: 24, padding: 24, gap: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={selected.icon} color={t.accent} size={29} /></View>
          <View style={{ flex: 1, gap: 6 }}><Text style={{ color: isCurrent ? t.accent : t.muted, fontSize: 10, fontWeight: '600', letterSpacing: 1.4 }}>{isCurrent ? 'YOUR CURRENT STAGE' : selected.key === 'preflower' ? 'TRANSITION GUIDE' : 'STAGE OVERVIEW'}</Text><Text accessibilityRole="header" style={{ color: t.text, fontSize: 29, letterSpacing: -.7, fontWeight: '600' }}>{selected.title}</Text></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 22 }}>
          {isCurrent && <View style={{ flex: 1, gap: 7 }}><Text style={{ color: t.text, fontSize: 38, fontWeight: '500', letterSpacing: -1 }}>{elapsed}<Text style={{ fontSize: 14, color: t.muted }}> days</Text></Text><Text style={{ color: t.muted, fontSize: 12 }}>Time in this stage</Text>{timing.estimated && <Text style={{ color: t.muted, fontSize: 11 }}>Estimated timing</Text>}</View>}
          <View style={{ flex: 1, gap: 7 }}><Text style={{ color: t.text, fontSize: duration ? 38 : 22, fontWeight: '500', letterSpacing: -1 }}>{duration?.value || (selected.key === 'harvested' ? 'Growth ends' : selected.key === 'completed' ? 'Finished' : '—')}</Text><Text style={{ color: t.muted, fontSize: 12 }}>{duration ? `${duration.unit} · duration guide` : 'Living growth cycle'}</Text>{duration?.value.endsWith('+') && <Text style={{ color: t.muted, fontSize: 11 }}>May continue longer</Text>}</View>
        </View>
        {isCurrent ? <View style={{ borderTopWidth: 1, borderColor: t.elevated, paddingTop: 18, flexDirection: 'row', gap: 18 }}>
          <View style={{ flex: 1, gap: 7 }}><Text style={{ color: t.muted, fontSize: 11 }}>Stage began{timing.estimated ? ' · estimate' : ''}</Text><Text style={{ color: t.text, fontSize: 16 }}>{growthDate(timing.startedOn)}</Text></View>
          <View style={{ flex: 1, gap: 7 }}><Text style={{ color: t.muted, fontSize: 11 }}>Next check-in</Text><Text style={{ color: t.text, fontSize: 16 }}>{due ? ['profile', 'location'].includes(due.kind) ? 'Setup needed' : 'Ready to review' : next ? growthDate(next.checkOn) : 'Based on plant signs'}</Text></View>
        </View> : <Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>{selected.key === 'preflower' ? 'A transition within vegetative growth. It does not replace the confirmed plant stage.' : `You’re exploring the guide. ${plant.name} remains in ${current.title.toLowerCase()}.`}</Text>}
      </View>
      {isCurrent && plant.growthStage === 'vegetative' && plant.preflowerObservedOn && <Text style={{ color: t.muted, lineHeight: 21 }}>Early flowering signs recorded · {growthDate(plant.preflowerObservedOn)}</Text>}
      {isCurrent && due && !['profile', 'location'].includes(due.kind) && <View style={{ borderLeftWidth: 2, borderColor: t.accent, paddingLeft: 16, gap: 7 }}><Text style={{ color: t.accent, fontSize: 12, fontWeight: '600' }}>A moment to check in</Text><Text style={{ color: t.text, fontSize: 15, lineHeight: 23 }}>{due.prompt}</Text></View>}
      <View style={{ gap: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 19, fontWeight: '600' }}>About this stage</Text><View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: t.elevated }}><Text style={{ color: t.muted, fontSize: 10 }}>Content preview</Text></View></View><Text style={{ color: t.muted, fontSize: 13, lineHeight: 20 }}>Detailed guidance will be added here. These sections are placeholders.</Text></View>
      {GUIDE_PLACEHOLDERS.map(section => <View key={section.title} style={{ gap: 13, paddingBottom: 22, borderBottomWidth: 1, borderColor: t.elevated }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><MaterialCommunityIcons name={section.icon} size={20} color={t.muted} /><Text style={{ color: t.text, fontSize: 16, fontWeight: '500' }}>{section.title}</Text></View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 8 }}>{[96, 100, 65].map((width, index) => <View key={index} style={{ width: `${width}%`, height: 7, borderRadius: 4, backgroundColor: t.elevated }} />)}</View>
        <Text style={{ color: t.muted, fontSize: 12, lineHeight: 19 }}>{section.note}</Text>
      </View>)}
    </ScrollView>
    {(mutable || !isCurrent) && <View style={{ borderTopWidth: 1, borderColor: t.elevated, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}><View style={{ width: '100%', maxWidth: 720, alignSelf: 'center' }}><PlantActionButton label={!isCurrent ? 'Back to current stage' : due ? ['profile', 'location'].includes(due.kind) ? 'Set up stage checks' : 'Review stage' : 'Update stage'} icon={!isCurrent ? 'arrow-left' : 'sprout-outline'} theme={t} primary={isCurrent} onPress={() => isCurrent ? setReviewOpen(true) : select(current.key)} /></View></View>}
    {reviewOpen && <PlantEditorSheet title="Stage check-in" subtitle={`${plant.name} · ${current.title}`} theme={t} busy={reviewBusy} onClose={() => setReviewOpen(false)}><GrowthStageCard controlsOnly plantId={id} plant={plant} theme={t} onBusyChange={setReviewBusy} onHarvest={harvest} onEditPlant={edit} onSaved={value => { setMessage(value); setReviewOpen(false); setChosen(null); }} /></PlantEditorSheet>}
    <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={4500}>{message}</Snackbar>
  </SafeAreaView>;
}
