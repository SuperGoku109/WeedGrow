import React from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Snackbar } from 'react-native-paper';
import { GrowPress, GrowReveal, useReducedMotion } from '@/ui/GrowMotion';
import { addPlantLog } from '@/lib/logs/addPlantLog';
import { buildManualPlantLog, localDateKey, type JournalCategory } from '@/lib/logs/plantJournal';
import { evaluateSuggestionCardsForPlant, type SuggestionCard } from '@/lib/suggestions/suggestionCards';
import { usePlant } from '../hooks/usePlant';
import { usePlantJournalData } from '../hooks/usePlantJournalData';
import { useProgressGallery } from '../hooks/useProgressGallery';
import LoadingView from '../components/LoadingView';
import NotFoundView from '../components/NotFoundView';
import { plantThemes } from '../components/plantDetailTheme';
import { detailStyles as ds, EmptyCard, InsightPanel, PlantDetails, PlantIdentity, SectionTitle, WeatherPanel } from '../components/PlantDetailPanels';
import { JournalCalendar, JournalTimeline } from '../components/PlantJournal';
import PlantLogComposer from '../components/PlantLogComposer';
import { PhotoComposer, PlantPhotoGallery } from '../components/PlantPhotoGallery';

type Section = 'Today' | 'Journal' | 'Photos' | 'Details';
const SECTIONS: Section[] = ['Today', 'Journal', 'Photos', 'Details'];
const THEME_KEY = 'weedgrow.plant-theme';
function dateOffset(date: string, offset: number) { const result = new Date(`${date}T12:00:00`); result.setDate(result.getDate() + offset); return localDateKey(result); }
export default function PlantDetailScreen() {
  const params = useLocalSearchParams<{ id: string; fromGroupId?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const groupId = Array.isArray(params.fromGroupId) ? params.fromGroupId[0] : params.fromGroupId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { plant, loading } = usePlant(id);
  const [themeName, setThemeName] = React.useState<keyof typeof plantThemes>('grove');
  const t = plantThemes[themeName];
  const [today, setToday] = React.useState(localDateKey());
  const [selected, setSelected] = React.useState(today);
  const [anchor, setAnchor] = React.useState(today);
  const [range, setRange] = React.useState<7 | 14>(7);
  const [section, setSection] = React.useState<Section>('Today');
  const [composer, setComposer] = React.useState<{ category?: JournalCategory; date: string } | null>(null);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [refresh, setRefresh] = React.useState(0);
  const [cards, setCards] = React.useState<SuggestionCard[]>([]);
  const [insightLoading, setInsightLoading] = React.useState(false);
  const [insightError, setInsightError] = React.useState('');
  const scroll = React.useRef<ScrollView>(null);
  const dates = React.useMemo(() => Array.from({ length: range }, (_, index) => dateOffset(anchor, index - 3)), [anchor, range]);
  const data = usePlantJournalData(id, dates[0], dates[dates.length - 1]);
  const gallery = useProgressGallery(id);
  const todayLogs = data.logs[today] || [];
  const activitySignature = todayLogs.map(log => log.id).sort().join(',');
  const hasLocation = typeof plant?.location?.lat === 'number' && typeof plant?.location?.lng === 'number';
  React.useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_KEY).then(saved => { if (active && (saved === 'grove' || saved === 'daylight')) setThemeName(saved); }).catch(() => {});
    return () => { active = false; };
  }, []);
  React.useEffect(() => { const timer = setInterval(() => setToday(localDateKey()), 60000); return () => clearInterval(timer); }, []);
  React.useEffect(() => { setSelected(today); setAnchor(today); }, [today, id]);
  const goBack = React.useCallback(() => {
    if (router.canGoBack()) router.back();
    else if (groupId) router.replace({ pathname: '/group/[id]', params: { id: groupId } });
    else router.replace('/(tabs)?tabIndex=1');
  }, [router, groupId]);
  useFocusEffect(React.useCallback(() => {
    setToday(localDateKey()); setRefresh(value => value + 1);
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => listener.remove();
  }, [goBack]));
  React.useEffect(() => {
    let cancelled = false;
    setCards([]); setInsightError('');
    if (!plant || !hasLocation || !id) { setInsightLoading(false); return; }
    setInsightLoading(true);
    evaluateSuggestionCardsForPlant({ ...plant, id }).then(result => { if (!cancelled) setCards(result?.cards || []); })
      .catch(() => { if (!cancelled) setInsightError('Care suggestions could not be refreshed.'); })
      .finally(() => { if (!cancelled) setInsightLoading(false); });
    return () => { cancelled = true; };
  }, [plant, id, hasLocation, today, activitySignature, refresh]);
  const editPlant = () => router.push({ pathname: '/plant/[id]/edit', params: { id } });
  const switchSection = (next: Section) => {
    setSection(next);
    if (next === 'Today') { setAnchor(today); setSelected(today); }
    scroll.current?.scrollTo({ y: 0, animated: !reduced });
  };
  const openLog = (category?: JournalCategory) => {
    const date = section === 'Journal' ? selected : today;
    setComposer({ category, date: date > today ? today : date });
  };
  const saveLog = async (category: JournalCategory, description: string, date: string) => {
    await addPlantLog(id, buildManualPlantLog(category, description), date === today ? undefined : date);
    setSelected(date); setAnchor(date); setSection('Journal'); setComposer(null); setRefresh(value => value + 1);
    setMessage('Journal entry saved.');
    scroll.current?.scrollTo({ y: 0, animated: !reduced });
  };
  const toggleTheme = () => {
    const next = themeName === 'grove' ? 'daylight' : 'grove'; setThemeName(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => setMessage('Theme changed for this session. Could not save the preference.'));
  };
  if (loading) return <LoadingView />;
  if (!plant) return <NotFoundView />;
  const selectedLogs = data.logs[selected] || [];
  const dayLabel = new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.background }}>
    <View style={[s.toolbar, { borderBottomColor: t.border }]}>
      <GrowPress accessibilityRole="button" accessibilityLabel="Back to plants" onPress={goBack} style={s.iconButton}><MaterialCommunityIcons name="arrow-left" size={22} color={t.text} /></GrowPress>
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', flex: 1 }}>weedgrow<Text style={{ color: t.accent }}>.</Text><Text style={{ color: t.muted, fontSize: 13, fontWeight: '400' }}> / plant space</Text></Text>
      <GrowPress accessibilityRole="button" accessibilityLabel="Edit plant details" onPress={editPlant} style={[s.iconButton, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}><MaterialCommunityIcons name="pencil-outline" size={18} color={t.accent} /><Text style={{ color: t.accent, fontSize: 14 }}>Edit</Text></GrowPress>
      <GrowPress accessibilityRole="button" accessibilityLabel={`Switch to ${themeName === 'grove' ? 'Daylight' : 'Grove'} theme`} onPress={toggleTheme} style={[s.iconButton, { backgroundColor: t.surface, borderRadius: 14 }]}><MaterialCommunityIcons name={themeName === 'grove' ? 'weather-sunny' : 'weather-night'} size={19} color={t.accent} /></GrowPress>
    </View>
    <ScrollView ref={scroll} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 26 }}>
      <View style={{ paddingHorizontal: 18 }}><PlantIdentity plant={plant} theme={t} /></View>
      <View style={{ paddingHorizontal: 18, paddingTop: 13, paddingBottom: 10, backgroundColor: t.background }}><View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: 16, padding: 4 }}>{SECTIONS.map(item => <View key={item} style={{ flex: 1 }}><GrowPress accessibilityRole="tab" accessibilityState={{ selected: section === item }} onPress={() => switchSection(item)} style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: section === item ? t.accent : 'transparent' }}><Text style={{ color: section === item ? t.onAccent : t.muted, fontSize: 13, fontWeight: '700' }}>{item}</Text></GrowPress></View>)}</View></View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 20 }}>
        {section === 'Today' && <GrowReveal key="today">
          <SectionTitle title="Needs attention" theme={t} caption={new Date(today + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} />
          {insightLoading ? <Text style={[ds.body, { color: t.muted }]}>Checking care suggestions…</Text> : insightError ? <EmptyCard theme={t} title="Suggestions unavailable" text={insightError} /> : !hasLocation ? <EmptyCard theme={t} title="Add a location for care advice" text="Use Edit to set your plant’s location and enable weather-based suggestions." /> : cards.some(card => ['critical', 'warn', 'watch'].includes(card.severity)) ? cards.filter(card => ['critical', 'warn', 'watch'].includes(card.severity)).map(card => <InsightPanel key={card.id} card={card} theme={t} onLog={() => openLog(card.kind === 'watering' ? 'watering' : 'health')} />) : <Text style={[ds.body, { color: t.muted }]}>No care alerts right now.</Text>}
          <SectionTitle title="Today’s activity" theme={t} caption={todayLogs.length + (todayLogs.length === 1 ? ' entry' : ' entries')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            {([{ label: 'Water', category: 'watering', type: 'watering', icon: 'water-outline' }, { label: 'Feed', category: 'feeding', type: 'fertilizing', icon: 'flask-outline' }] as const).map(action => {
              const recorded = todayLogs.some(log => log.type === action.type);
              const status = data.loading ? 'Loading…' : data.error ? 'Status unavailable' : recorded ? 'Recorded today' : 'Not recorded today';
              return <View key={action.category} style={{ flex: 1, minWidth: 130 }}><GrowPress accessibilityRole="button" accessibilityLabel={action.label + ': ' + status + '. Add log'} onPress={() => openLog(action.category)} style={[ds.card, { backgroundColor: t.surface, borderColor: recorded ? t.accent : t.border, minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: 10 }]}><MaterialCommunityIcons name={recorded ? 'check-circle-outline' : action.icon} size={23} color={recorded ? t.accent : action.category === 'watering' ? t.water : t.accent} /><View style={{ flex: 1 }}><Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{action.label}</Text><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18, marginTop: 3 }}>{status}</Text></View></GrowPress></View>;
            })}
          </View>
          <JournalTimeline theme={t} logs={todayLogs.slice(0, 3)} loading={data.loading} error={data.error} />
          <GrowPress accessibilityRole="button" onPress={() => switchSection('Journal')} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: t.accent, fontSize: 14 }}>View full journal →</Text></GrowPress>
          <SectionTitle title="Conditions" theme={t} />
          <WeatherPanel compact theme={t} weather={data.weather[today]} loading={data.weatherLoading} error={data.weatherError} label={plant.locationNickname || plant.environment} />
          {!insightLoading && cards.some(card => card.severity === 'info') && <><SectionTitle title="Care notes" theme={t} />{cards.filter(card => card.severity === 'info').map(card => <InsightPanel key={card.id} card={card} theme={t} />)}</>}
          {hasLocation && <GrowPress accessibilityRole="button" onPress={() => setRefresh(value => value + 1)} disabled={insightLoading} style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}><Text style={{ color: t.accent, fontSize: 13 }}>{insightLoading ? 'Refreshing care advice…' : 'Refresh care advice ↻'}</Text></GrowPress>}
        </GrowReveal>}
        {section === 'Journal' && <GrowReveal key="journal">
          <JournalCalendar theme={t} dates={dates} selected={selected} range={range} logs={data.logs} onSelect={setSelected} onRange={value => { setRange(value); setAnchor(selected); }} onMove={direction => { const next = dateOffset(anchor, direction * range); setAnchor(next); setSelected(next); }} onToday={() => { setAnchor(today); setSelected(today); }} onJump={date => { setAnchor(date); setSelected(date); }} />
          <SectionTitle title={dayLabel} theme={t} caption={selected > today ? 'UPCOMING' : selected === today ? 'TODAY' : 'PAST ENTRY'} />
          {selected <= today && <><SectionTitle title="Activity" theme={t} caption={`${selectedLogs.length} entries`} /><JournalTimeline key={selected} logs={selectedLogs} loading={data.loading} error={data.error} theme={t} /></>}
          {selected > today && <Text style={{ color: t.muted, fontSize: 14, lineHeight: 22, marginTop: 14 }}>Forecast only. Choose today or a past date to record completed activities.</Text>}
          <SectionTitle title="Conditions for this day" theme={t} />
          <WeatherPanel key={selected} theme={t} weather={data.weather[selected]} loading={data.weatherLoading} error={data.weatherError} label={selected > today ? 'Forecast' : 'Recorded weather'} />
        </GrowReveal>}
        {section === 'Photos' && <PlantPhotoGallery pics={gallery.pics} loading={gallery.loading} error={gallery.error} theme={t} onAdd={() => setPhotoOpen(true)} />}
        {section === 'Details' && <PlantDetails plant={plant} theme={t} onEdit={editPlant} />}
      </View>
    </ScrollView>
    <View style={{ backgroundColor: t.background, borderTopWidth: 1, borderColor: t.border, paddingBottom: Math.max(12, insets.bottom), paddingTop: 11, paddingHorizontal: 18 }}><View style={{ width: '100%', maxWidth: 724, alignSelf: 'center', flexDirection: 'row', gap: 10 }}>
      <GrowPress accessibilityRole="button" accessibilityLabel="Add progress photo" onPress={() => setPhotoOpen(true)} style={[ds.button, { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, paddingHorizontal: 17 }]}><MaterialCommunityIcons name="camera-plus-outline" color={t.accent} size={22} /></GrowPress>
      <View style={{ flex: 1 }}><GrowPress accessibilityRole="button" accessibilityLabel="Add journal log" disabled={section === 'Journal' && selected > today} onPress={() => openLog()} style={[ds.button, { backgroundColor: t.accent, opacity: section === 'Journal' && selected > today ? 0.5 : 1 }]}><MaterialCommunityIcons name="plus" color={t.onAccent} size={21} /><Text style={{ color: t.onAccent, fontWeight: '700', fontSize: 14 }}>Add log<Text style={{ fontWeight: '400', fontSize: 13 }}> · {section === 'Journal' && selected > today ? 'future date' : section === 'Journal' && selected < today ? new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'today'}</Text></Text></GrowPress></View>
    </View></View>
    {!!composer && <PlantLogComposer theme={t} name={plant.name} initialDate={composer.date} initialCategory={composer.category} onClose={() => setComposer(null)} onSave={saveLog} />}
    {photoOpen && <PhotoComposer plantId={id} theme={t} onClose={() => setPhotoOpen(false)} onSaved={() => { setPhotoOpen(false); switchSection('Photos'); setMessage('Progress photo added to your gallery.'); }} />}
    <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={4000} style={{ bottom: 82 }}>{message}</Snackbar>
  </SafeAreaView>;
}
const s = StyleSheet.create({ toolbar: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 }, iconButton: { minWidth: 44, minHeight: 44, padding: 10 } });
