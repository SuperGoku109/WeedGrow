import React from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import PlantLogComposer, { logChoices } from '../components/PlantLogComposer';
import { PhotoComposer, PlantPhotoGallery } from '../components/PlantPhotoGallery';

type Section = 'Overview' | 'Journal' | 'Gallery' | 'Details';
const SECTIONS: Section[] = ['Overview', 'Journal', 'Gallery', 'Details'];
const THEME_KEY = 'weedgrow.plant-theme';
function dateOffset(date: string, offset: number) { const result = new Date(`${date}T12:00:00`); result.setDate(result.getDate() + offset); return localDateKey(result); }
export default function PlantDetailScreen() {
  const params = useLocalSearchParams<{ id: string; fromGroupId?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const groupId = Array.isArray(params.fromGroupId) ? params.fromGroupId[0] : params.fromGroupId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { plant, loading } = usePlant(id);
  const [themeName, setThemeName] = React.useState<keyof typeof plantThemes>('grove');
  const t = plantThemes[themeName];
  const [today, setToday] = React.useState(localDateKey());
  const [selected, setSelected] = React.useState(today);
  const [anchor, setAnchor] = React.useState(today);
  const [range, setRange] = React.useState<7 | 14>(7);
  const [section, setSection] = React.useState<Section>('Overview');
  const [composer, setComposer] = React.useState<{ category: JournalCategory; date: string } | null>(null);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [refresh, setRefresh] = React.useState(0);
  const [cards, setCards] = React.useState<SuggestionCard[]>([]);
  const [insightLoading, setInsightLoading] = React.useState(false);
  const [insightError, setInsightError] = React.useState('');
  const scroll = React.useRef<ScrollView>(null);
  const heroHeight = React.useRef(0);
  const actionsHeight = React.useRef(0);
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
    if (next === 'Overview') { setAnchor(today); setSelected(today); }
    scroll.current?.scrollTo({ y: (heroHeight.current + actionsHeight.current), animated: !reduced });
  };
  const openLog = (category: JournalCategory = 'watering') => {
    const date = section === 'Journal' ? selected : today;
    setComposer({ category, date: date > today ? today : date });
  };
  const saveLog = async (category: JournalCategory, description: string, date: string) => {
    await addPlantLog(id, buildManualPlantLog(category, description), date === today ? undefined : date);
    setSelected(date); setAnchor(date); setSection('Journal'); setComposer(null); setRefresh(value => value + 1);
    setMessage('A little care, recorded. Your journal is up to date.');
    scroll.current?.scrollTo({ y: (heroHeight.current + actionsHeight.current), animated: !reduced });
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
      <Text style={{ color: t.text, fontSize: 15, fontWeight: '700', flex: 1 }}>weedgrow<Text style={{ color: t.accent }}>.</Text><Text style={{ color: t.muted, fontSize: 11, fontWeight: '400' }}> / plant space</Text></Text>
      <GrowPress accessibilityRole="button" accessibilityLabel={`Switch to ${themeName === 'grove' ? 'Daylight' : 'Grove'} theme`} onPress={toggleTheme} style={[s.iconButton, { backgroundColor: t.surface, borderRadius: 14 }]}><MaterialCommunityIcons name={themeName === 'grove' ? 'weather-sunny' : 'weather-night'} size={19} color={t.accent} /></GrowPress>
    </View>
    <ScrollView ref={scroll} stickyHeaderIndices={[2]} showsVerticalScrollIndicator={false} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 26 }}>
      <View onLayout={event => { heroHeight.current = event.nativeEvent.layout.height; }} style={{ paddingHorizontal: 18, paddingTop: 16 }}><PlantIdentity plant={plant} theme={t} onEdit={editPlant} /></View>
      <View onLayout={event => { actionsHeight.current = event.nativeEvent.layout.height; }} style={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 7 }}><Text style={[ds.eyebrow, { color: t.muted, marginBottom: 12 }]}>A LITTLE CARE GOES A LONG WAY</Text><View style={{ flexDirection: 'row', gap: 7 }}>{logChoices.filter(choice => choice.key !== 'health').map(choice => <View key={choice.key} style={{ flex: 1 }}><GrowPress accessibilityRole="button" accessibilityLabel={`Add ${choice.label} log`} onPress={() => openLog(choice.key)} style={{ alignItems: 'center', paddingVertical: 12, borderWidth: 1, borderColor: t.border, borderRadius: 17, backgroundColor: t.surface }}><MaterialCommunityIcons name={choice.icon} size={21} color={choice.key === 'watering' ? t.water : choice.key === 'pests' ? t.warm : t.accent} /><Text style={{ fontSize: 10, color: t.text, marginTop: 7 }}>{choice.label}</Text></GrowPress></View>)}</View></View>
      <View style={{ paddingHorizontal: 18, paddingTop: 13, paddingBottom: 10, backgroundColor: t.background }}><View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: 16, padding: 4 }}>{SECTIONS.map(item => <View key={item} style={{ flex: 1 }}><GrowPress accessibilityRole="tab" accessibilityState={{ selected: section === item }} onPress={() => switchSection(item)} style={{ alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: section === item ? t.accent : 'transparent' }}><Text style={{ color: section === item ? t.onAccent : t.muted, fontSize: 11, fontWeight: '700' }}>{item}</Text></GrowPress></View>)}</View></View>
      <View style={{ paddingHorizontal: 18, minHeight: Math.max(300, viewportHeight - insets.top - insets.bottom - 176) }}>
        {section === 'Overview' && <GrowReveal key="overview">
          <SectionTitle title="Today in your grow" theme={t} caption={new Date(`${today}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()} />
          {!insightLoading && cards[0] && ['critical', 'warn'].includes(cards[0].severity) && <InsightPanel card={cards[0]} theme={t} />}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>{[['Water', todayLogs.some(log => log.type === 'watering') ? 'Recorded today' : 'Not recorded'], ['Feed', todayLogs.some(log => log.type === 'fertilizing') ? 'Recorded today' : 'Not recorded']].map(([label, value]) => <View key={label} style={[ds.card, { flex: 1, padding: 14, backgroundColor: t.surface, borderColor: t.border }]}><Text style={{ color: t.muted, fontSize: 10 }}>{label.toUpperCase()}</Text><Text style={{ color: t.text, fontSize: 12, fontWeight: '600', marginTop: 7 }}>{data.loading ? 'Loading…' : data.error ? 'Unavailable' : value}</Text></View>)}</View>
          <WeatherPanel theme={t} weather={data.weather[today]} loading={data.weatherLoading} error={data.weatherError} label={plant.locationNickname || plant.environment} />
          <SectionTitle title="Care notes" theme={t} caption="WEATHER-BASED INSIGHTS" />
          {insightLoading ? <EmptyCard theme={t} title="Reading the conditions…" text="Checking the latest weather and watering history." /> : cards.length ? cards.filter((card, index) => index !== 0 || !['critical', 'warn'].includes(card.severity)).map(card => <InsightPanel key={card.id} card={card} theme={t} />) : <EmptyCard theme={t} title={insightError ? 'Suggestions unavailable' : 'Room to grow'} text={insightError || (hasLocation ? 'No care suggestions available for this plant yet.' : 'Add a location in Edit plant to enable weather-based care notes.')} />}
          <GrowPress accessibilityRole="button" onPress={() => setRefresh(value => value + 1)} disabled={insightLoading} style={{ paddingVertical: 12 }}><Text style={{ color: t.accent, fontSize: 11 }}>Refresh care notes ↻</Text></GrowPress>
          <SectionTitle title="Today's journal" theme={t} caption={`${todayLogs.length} ENTRIES`} /><JournalTimeline theme={t} logs={todayLogs} loading={data.loading} error={data.error} />
          <GrowPress accessibilityRole="button" onPress={() => switchSection('Journal')} style={[ds.button, { backgroundColor: t.elevated, marginTop: 12 }]}><Text style={{ color: t.accent, fontWeight: '600', fontSize: 12 }}>Explore the journal →</Text></GrowPress>
        </GrowReveal>}
        {section === 'Journal' && <GrowReveal key="journal">
          <JournalCalendar theme={t} dates={dates} selected={selected} range={range} logs={data.logs} onSelect={setSelected} onRange={value => { setRange(value); setAnchor(selected); }} onMove={direction => { const next = dateOffset(anchor, direction * range); setAnchor(next); setSelected(next); }} onToday={() => { setAnchor(today); setSelected(today); }} onJump={date => { setAnchor(date); setSelected(date); }} />
          <SectionTitle title={dayLabel} theme={t} caption={selected > today ? 'UPCOMING' : selected === today ? 'TODAY' : 'PAST ENTRY'} />
          <WeatherPanel theme={t} weather={data.weather[selected]} loading={data.weatherLoading} error={data.weatherError} label={selected > today ? 'Forecast' : 'Conditions for this day'} />
          <SectionTitle title="The day's story" theme={t} caption={`${selectedLogs.length} ENTRIES`} /><JournalTimeline key={selected} logs={selectedLogs} loading={data.loading} error={data.error} theme={t} />
          {selected <= today ? <GrowPress accessibilityRole="button" onPress={() => openLog()} style={[ds.button, { backgroundColor: t.elevated, marginTop: 14 }]}><MaterialCommunityIcons name="plus" size={18} color={t.accent} /><Text style={{ color: t.accent, fontWeight: '600', fontSize: 12 }}>Add entry for {dayLabel}</Text></GrowPress> : <Text style={{ color: t.muted, fontSize: 12, lineHeight: 19, marginTop: 14 }}>This is a forecast day. Record activities once they have happened.</Text>}
          <Text style={{ color: t.muted, fontSize: 10, lineHeight: 17, marginTop: 18 }}>Use the arrows to browse older weeks. Dates and journal entries follow your local time.</Text>
        </GrowReveal>}
        {section === 'Gallery' && <PlantPhotoGallery pics={gallery.pics} loading={gallery.loading} error={gallery.error} theme={t} onAdd={() => setPhotoOpen(true)} />}
        {section === 'Details' && <PlantDetails plant={plant} theme={t} onEdit={editPlant} />}
      </View>
    </ScrollView>
    <View style={{ backgroundColor: t.background, borderTopWidth: 1, borderColor: t.border, paddingBottom: Math.max(12, insets.bottom), paddingTop: 11, paddingHorizontal: 18 }}><View style={{ width: '100%', maxWidth: 724, alignSelf: 'center', flexDirection: 'row', gap: 10 }}>
      <GrowPress accessibilityRole="button" accessibilityLabel="Add progress photo" onPress={() => setPhotoOpen(true)} style={[ds.button, { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, paddingHorizontal: 17 }]}><MaterialCommunityIcons name="camera-plus-outline" color={t.accent} size={22} /></GrowPress>
      <View style={{ flex: 1 }}><GrowPress accessibilityRole="button" accessibilityLabel="Add journal log" onPress={() => openLog()} style={[ds.button, { backgroundColor: t.accent }]}><MaterialCommunityIcons name="plus" color={t.onAccent} size={21} /><Text style={{ color: t.onAccent, fontWeight: '700', fontSize: 14 }}>Add log<Text style={{ fontWeight: '400', fontSize: 11 }}> · {section === 'Journal' && selected < today ? new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'today'}</Text></Text></GrowPress></View>
    </View></View>
    {!!composer && <PlantLogComposer theme={t} name={plant.name} initialDate={composer.date} initialCategory={composer.category} onClose={() => setComposer(null)} onSave={saveLog} />}
    {photoOpen && <PhotoComposer plantId={id} theme={t} onClose={() => setPhotoOpen(false)} onSaved={() => { setPhotoOpen(false); switchSection('Gallery'); setMessage('Progress photo added to your gallery.'); }} />}
    <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={4000} style={{ bottom: 82 }}>{message}</Snackbar>
  </SafeAreaView>;
}
const s = StyleSheet.create({ toolbar: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 }, iconButton: { padding: 10 } });
