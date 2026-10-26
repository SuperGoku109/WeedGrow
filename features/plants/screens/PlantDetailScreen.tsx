import LoadError from '@/ui/LoadError';
import { adviceInput } from '@/lib/suggestions/adviceInputs';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import PlantMovementHistory from '../components/PlantMovementHistory';
import { isCalendarDay, plantDay } from '@/lib/dates/plantDay';
import type { JournalSearchFilters } from '../components/JournalSearch';
import { useJournalDay } from '../hooks/useJournalDay';
import { journalEntryDay } from '../journalPresentation';
import React from 'react';
import { BackHandler, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Snackbar } from 'react-native-paper';
import { GrowPress, useReducedMotion } from '@/ui/GrowMotion';
import { saveJournalEntry, deleteJournalEntry, type JournalEntry, type LogInput } from '@/lib/logs/journalRepository';
import ActionDialog from '@/ui/ActionDialog';
import JournalSearch from '../components/JournalSearch';
import { journalCategory } from '@/lib/logs/plantJournal';
import { buildManualPlantLog, type JournalCategory } from '@/lib/logs/plantJournal';
import { evaluateSuggestionCardsForPlant, type SuggestionCard } from '@/lib/suggestions/suggestionCards';
import { usePlant } from '../hooks/usePlant';
import { usePlantJournalData } from '../hooks/usePlantJournalData';
import { useProgressGallery } from '../hooks/useProgressGallery';
import LoadingView from '../components/LoadingView';
import NotFoundView from '../components/NotFoundView';
import { plantThemes } from '../components/plantDetailTheme';
import { detailStyles as ds, PlantDetails, SectionTitle } from '../components/PlantDetailPanels';
import PlantBanner from '../components/PlantBanner';
import { JournalTimeline } from '../components/PlantJournal';
import JournalDateNavigator from '../components/JournalDateNavigator';
import DailyCareAdvice from '../components/DailyCareAdvice';
import PlantLogComposer from '../components/PlantLogComposer';
import { PhotoComposer, PlantPhotoGallery } from '../components/PlantPhotoGallery';
import { presentCareCard, weatherFreshness } from '../plantCare';
import PlantLifecycle from '../components/PlantLifecycle';
import PlantWeather from '../components/PlantWeather';
import PlantSectionEditor from '../components/PlantSectionEditor';

type Section = 'Journal' | 'Photos' | 'Details';
const SECTIONS: Section[] = ['Journal', 'Photos', 'Details'];
const THEME_KEY = 'weedgrow.plant-theme';
export default function PlantDetailScreen() {
  const params = useLocalSearchParams<{ id: string; section?: string; fromGroupId?: string; welcome?: string; editSection?: string; journalDate?: string; returnToPlants?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const groupId = Array.isArray(params.fromGroupId) ? params.fromGroupId[0] : params.fromGroupId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { plant, loading, error: plantError, refresh: retryPlant } = usePlant(id);
  const [themeName, setThemeName] = React.useState<keyof typeof plantThemes>('grove');
  const t = plantThemes[themeName];
  const clock = useMinuteClock();
  const day = useJournalDay(id, plant?.locationTimeZone, clock, plant?.createdAt?.toDate ? plantDay(plant.createdAt.toDate(), plant.locationTimeZone) : undefined);
  const { today, selected, dates, isToday, isFuture, backToToday, jump } = day;
  const [section, setSection] = React.useState<Section>(params.section === 'Photos' || params.section === 'Details' ? params.section : 'Journal');
  React.useEffect(() => { setSection(params.section === 'Photos' || params.section === 'Details' ? params.section : 'Journal'); if (params.section === 'Today') backToToday(); }, [id, params.section, backToToday]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchFilters, setSearchFilters] = React.useState<JournalSearchFilters>({ text: '', category: 'all', start: '', end: '', datesOpen: false });
  React.useEffect(() => setSearchFilters({ text: '', category: 'all', start: '', end: '', datesOpen: false }), [id]);
  const [composer, setComposer] = React.useState<{ category?: JournalCategory; date: string; entry?: JournalEntry; origin: Section } | null>(null);
  const [deletingEntry, setDeletingEntry] = React.useState<JournalEntry | null>(null);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [editingSection, setEditingSection] = React.useState<string | null>(null);
  const [showWelcome, setShowWelcome] = React.useState(params.welcome === '1');
  React.useEffect(() => { if (params.editSection && plant) { setEditingSection(params.editSection); setSection('Details'); router.setParams({ editSection: undefined }); } }, [params.editSection, plant, router]);
  React.useEffect(() => { setShowWelcome(params.welcome === '1'); }, [id, params.welcome]);
  const [message, setMessage] = React.useState('');
  const [refresh, setRefresh] = React.useState(0);
  const [cards, setCards] = React.useState<SuggestionCard[]>([]);
  const [insightLoading, setInsightLoading] = React.useState(false);
  const [insightError, setInsightError] = React.useState('');
  const scroll = React.useRef<ScrollView>(null);
  const positions = React.useRef<Record<Section, number>>({ Journal: 0, Photos: 0, Details: 0 });
  const tabFocusPosition = React.useRef<{ section: Section; y: number } | null>(null);
  React.useEffect(() => { positions.current = { Journal: 0, Photos: 0, Details: 0 }; }, [id]);
  const restoring = React.useRef(false);
  React.useLayoutEffect(() => { restoring.current = true; }, [section, id]);
  const [bannerHeight, setBannerHeight] = React.useState(0);
  const [railPinned, setRailPinned] = React.useState(false);
  const pinned = React.useRef(false);
  const data = usePlantJournalData(id, dates[0], dates[dates.length - 1], plant?.locationTimeZone, section === 'Journal');
  const gallery = useProgressGallery(id, section === 'Photos');
  React.useEffect(() => {
    if (!restoring.current || (section === 'Journal' && (data.loading || insightLoading)) || (section === 'Photos' && gallery.loading)) return;
    const timer = setTimeout(() => { scroll.current?.scrollTo({ y: positions.current[section], animated: false }); restoring.current = false; }, 0);
    return () => clearTimeout(timer);
  }, [section, data.loading, gallery.loading, insightLoading]);
  const todayLogs = data.logs[today] || [];
  const activitySignature = todayLogs.filter(log => log.type === 'watering').map(log => `${log.id}:${log.mutationId || log.timestamp?.toMillis?.()}`).sort().join(',');
  const adviceKey = JSON.stringify(plant ? adviceInput({ ...plant, id }) : null);
  const adviceWeatherTime = data.weather[today]?.fetchedAt?.toMillis?.();

  const hasLocation = typeof plant?.location?.lat === 'number' && typeof plant?.location?.lng === 'number';
  React.useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_KEY).then(saved => { if (active && (saved === 'grove' || saved === 'daylight')) setThemeName(saved); }).catch(() => {});
    return () => { active = false; };
  }, []);
  React.useEffect(() => { if (typeof params.journalDate === 'string' && plant) { if (isCalendarDay(params.journalDate)) { setSection('Journal'); jump(params.journalDate); } router.setParams({ journalDate: undefined }); } }, [params.journalDate, plant, router, jump]);
  const goBack = React.useCallback(() => {
    if (params.returnToPlants === '1') { router.dismissTo({ pathname: '/(tabs)', params: { tabIndex: '1' } }); return; }
    if (router.canGoBack()) router.back();
    else if (groupId) router.replace({ pathname: '/group/[id]', params: { id: groupId } });
    else router.replace('/(tabs)?tabIndex=1');
  }, [router, groupId, params.returnToPlants]);
  useFocusEffect(React.useCallback(() => {
    setRefresh(value => value + 1);
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => listener.remove();
  }, [goBack]));
  React.useEffect(() => {
    let cancelled = false; const controller = new AbortController();
    setCards([]); setInsightError('');
    if (adviceKey === 'null' || !hasLocation || !id || (section !== 'Journal' || !isToday)) { setInsightLoading(false); return; }
    setInsightLoading(true);
    if (data.loading || data.weatherLoading) return () => controller.abort();
    evaluateSuggestionCardsForPlant(JSON.parse(adviceKey), undefined, controller.signal).then(result => { if (!cancelled) setCards(result?.cards || []); })
      .catch(() => { if (!cancelled) setInsightError('Care suggestions could not be refreshed.'); })
      .finally(() => { if (!cancelled) setInsightLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [adviceKey, id, hasLocation, today, activitySignature, refresh, section, isToday, adviceWeatherTime, data.loading, data.weatherLoading]);
  const editPlant = () => router.push({ pathname: '/plant/[id]/edit', params: { id } });
  const switchSection = (next: Section) => {
    // Focusing a sticky tab can scroll its original layout box into view on web.
    // Keep that focus movement from replacing the outgoing reading position.
    if (tabFocusPosition.current?.section === section) positions.current[section] = tabFocusPosition.current.y;
    tabFocusPosition.current = null;
    setSection(next);
    // Restore the destination's own position after its content mounts.
  };
  const openLog = (category?: JournalCategory) => {
    if (section === 'Journal' && isFuture) return;
    const date = section === 'Journal' ? selected : today;
    setComposer({ category, date: date > today ? today : date, origin: section });
  };
  const saveLog = async (category: JournalCategory, description: string, date: string, measurements: Partial<LogInput>, requestId: string) => {
    await saveJournalEntry(id, { ...buildManualPlantLog(category, description), ...measurements }, date, composer?.entry, requestId);
    const currentDay = plantDay(new Date(), plant?.locationTimeZone);
    const keepPosition = section === 'Journal' && date === selected;
    day.select(date, currentDay); setSection('Journal'); setComposer(null); setRefresh(value => value + 1);
    setMessage(date === currentDay ? 'Activity recorded for today.' : 'Journal entry saved.');
    if (!keepPosition) { positions.current.Journal = 0; scroll.current?.scrollTo({ y: 0, animated: !reduced }); }
  };
  const editEntry = (entry: JournalEntry) => { const category = journalCategory(entry); if (['watering', 'feeding', 'pests', 'training', 'health', 'notes'].includes(category)) setComposer({ entry, category: category as JournalCategory, date: entry.calendarDay || plantDay(entry.timestamp.toDate(), entry.timeZone || plant?.locationTimeZone), origin: 'Journal' }); };
  const toggleTheme = () => {
    const next = themeName === 'grove' ? 'daylight' : 'grove'; setThemeName(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => setMessage('Theme changed for this session. Could not save the preference.'));
  };
  if (loading) return <LoadingView onBack={goBack} />;
  if (!plant && plantError) return <LoadError message={plantError} onRetry={retryPlant} onBack={goBack} />;
  if (!plant) return <NotFoundView />;
  const selectedLogs = data.logs[selected] || [];
  const displayCards = cards.map(card => presentCareCard(card, todayLogs.some(log => log.type === 'watering'), weatherFreshness(data.weather[today]).stale));
  const dayLabel = new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.background }}>
    <View style={[s.toolbar, { borderBottomColor: t.border }]}>
      <GrowPress accessibilityRole="button" accessibilityLabel="Back to plants" onPress={goBack} style={[s.iconButton, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}><MaterialCommunityIcons name="arrow-left" size={22} color={t.text} /><Text style={{ color: t.text, fontSize: 15 }}>Garden</Text></GrowPress>
      <View style={{ flex: 1 }} />
      <GrowPress accessibilityRole="button" accessibilityLabel={`Switch to ${themeName === 'grove' ? 'Daylight' : 'Grove'} theme`} onPress={toggleTheme} style={[s.iconButton, { backgroundColor: t.surface, borderRadius: 14 }]}><MaterialCommunityIcons name={themeName === 'grove' ? 'weather-sunny' : 'weather-night'} size={19} color={t.accent} /></GrowPress>
    </View>
    <ScrollView ref={scroll} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScrollBeginDrag={() => { restoring.current = false; tabFocusPosition.current = null; }} onContentSizeChange={() => { if (restoring.current && (section !== 'Journal' || (!data.loading && !insightLoading)) && (section !== 'Photos' || !gallery.loading)) scroll.current?.scrollTo({ y: positions.current[section], animated: false }); }} onScroll={event => { if (restoring.current && Math.abs(event.nativeEvent.contentOffset.y - positions.current[section]) < 1) restoring.current = false; if (!restoring.current) positions.current[section] = event.nativeEvent.contentOffset.y; const next = bannerHeight > 0 && event.nativeEvent.contentOffset.y >= bannerHeight; if (next !== pinned.current) { pinned.current = next; setRailPinned(next); } }} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 26 }}>
      <View onLayout={event => setBannerHeight(event.nativeEvent.layout.height)} style={{ paddingHorizontal: 18, paddingTop: 4 }}><PlantBanner plant={plant} theme={t} onEdit={editPlant} /></View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 8, backgroundColor: t.background }}><View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.surface, borderWidth: 1, borderTopWidth: railPinned ? 1 : 0, borderColor: t.border, borderTopLeftRadius: railPinned ? 24 : 0, borderTopRightRadius: railPinned ? 24 : 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, padding: 6, paddingTop: 8 }}>{SECTIONS.map(item => <View key={item} style={{ flex: 1, minWidth: 0 }}><GrowPress accessibilityRole="tab" onFocus={() => { if (item !== section) tabFocusPosition.current = { section, y: positions.current[section] }; }} aria-selected={section === item} accessibilityState={{ selected: section === item }} onPress={() => switchSection(item)} style={{ alignItems: 'center', minHeight: 48, justifyContent: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: section === item ? t.accent : 'transparent' }}><Text style={{ color: section === item ? t.onAccent : t.muted, fontSize: 13, fontWeight: '700' }}>{item}</Text></GrowPress></View>)}</View></View>
      <View style={{ paddingHorizontal: 18, paddingBottom: 20 }}>
        {section === 'Journal' && (!!data.error || !!data.weatherError) && <GrowPress accessibilityRole="button" onPress={data.retry} style={{ minHeight: 48, justifyContent: 'center', marginTop: 12 }}><Text accessibilityRole="alert" style={{ color: t.danger }}>{data.error || data.weatherError} Tap to retry.</Text></GrowPress>}
        {showWelcome && <View style={[ds.card, { backgroundColor: t.surface, borderColor: t.border, marginTop: 18, gap: 12 }]}>
          <Text style={[ds.title, { color: t.text }]}>Your plant is ready</Text>
          <Text style={[ds.body, { color: t.muted }]}>Your setup is saved. Here are a few ways to start its journal. You can do these whenever you’re ready.</Text>
          <GrowPress accessibilityRole="button" onPress={() => openLog()} style={{ paddingVertical: 12 }}><Text style={{ color: t.accent, fontSize: 14 }}>Record an activity</Text></GrowPress>
          <GrowPress accessibilityRole="button" onPress={() => gallery.pics.length ? switchSection('Photos') : setPhotoOpen(true)} style={{ paddingVertical: 12 }}><Text style={{ color: t.accent, fontSize: 14 }}>{gallery.pics.length ? 'View your first progress photo' : 'Add your first progress photo'}</Text></GrowPress>
          <GrowPress accessibilityRole="button" onPress={() => switchSection('Details')} style={{ paddingVertical: 12 }}><Text style={{ color: t.accent, fontSize: 14 }}>Review care and growing details</Text></GrowPress>
          <GrowPress accessibilityRole="button" accessibilityLabel="Dismiss plant next steps" onPress={() => { setShowWelcome(false); router.setParams({ welcome: '' }); }} style={{ paddingVertical: 12 }}><Text style={{ color: t.muted }}>Got it</Text></GrowPress>
        </View>}
        {section === 'Journal' && <View>
          <JournalDateNavigator today={today} selected={selected} dates={dates} logs={data.logs} historyStatus={data.loading ? 'loading' : data.error ? 'error' : 'ready'} theme={t} minimum={day.minimum} canGoBack={day.canGoBack} onSelect={day.select} onJump={day.jump} onMove={day.moveWeek} onToday={day.backToToday} onSearch={() => setSearchOpen(true)} />
          {isToday && <DailyCareAdvice key={id} cards={displayCards} loading={insightLoading || data.loading || data.weatherLoading} error={insightError} hasLocation={hasLocation} theme={t} onRefresh={() => setRefresh(value => value + 1)} />}
          <SectionTitle title={isToday ? 'Recorded today' : dayLabel} theme={t} caption={isFuture ? 'FORECAST' : data.loading ? undefined : data.error ? 'Unavailable' : selectedLogs.length ? selectedLogs.length + (selectedLogs.length === 1 ? ' entry' : ' entries') : undefined} />
          {!isFuture && <JournalTimeline key={'activity:' + selected} compactEmpty emptyMessage={isToday ? 'Nothing recorded today.' : 'No activity recorded on this day.'} logs={selectedLogs} loading={data.loading} error={data.error} theme={t} timeZone={plant.locationTimeZone} onEdit={editEntry} onDelete={setDeletingEntry} />}
          {isFuture && <Text style={[ds.body, { color: t.muted }]}>Forecast only. Choose today or an earlier date to record completed activities.</Text>}
          <SectionTitle title={isToday ? 'Conditions' : isFuture ? 'Forecast conditions' : 'Saved conditions'} theme={t} />
          <PlantWeather key={'conditions:' + selected} compact={isToday} theme={t} plantId={id} plant={plant} date={selected} weather={data.weather[selected]} savedError={data.weatherDayErrors?.[selected]} savedLoading={data.weatherLoading} />
        </View>}
        {section === 'Photos' && <PlantPhotoGallery plantId={id} hasMore={gallery.hasMore} onMore={() => void gallery.loadMore()} onRefresh={gallery.refresh} pics={gallery.pics} loading={gallery.loading} error={gallery.error} theme={t} onAdd={() => setPhotoOpen(true)} />}
        {section === 'Details' && <><PlantDetails plant={plant} theme={t} onEdit={() => setEditingSection('Basics')} onEditSection={setEditingSection} /><PlantLifecycle plantId={id} plant={plant} theme={t} /><View style={{ paddingVertical: 20 }}><PlantMovementHistory plantId={id} theme={t} /></View></>}
      </View>
    </ScrollView>
    <View style={{ backgroundColor: t.background, borderTopWidth: 1, borderColor: t.border, paddingBottom: Math.max(12, insets.bottom), paddingTop: 11, paddingHorizontal: 18 }}><View style={{ width: '100%', maxWidth: 724, alignSelf: 'center', flexDirection: 'row', gap: 10 }}>
      <GrowPress accessibilityRole="button" accessibilityLabel="Add progress photo" onPress={() => setPhotoOpen(true)} style={[ds.button, { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, paddingHorizontal: 17 }]}><MaterialCommunityIcons name="camera-plus-outline" color={t.accent} size={22} /></GrowPress>
      <View style={{ flex: 1 }}><GrowPress accessibilityRole="button" accessibilityLabel="Add journal log" disabled={section === 'Journal' && selected > today} onPress={() => openLog()} style={[ds.button, { backgroundColor: t.accent, opacity: section === 'Journal' && selected > today ? 0.5 : 1 }]}><MaterialCommunityIcons name="plus" color={t.onAccent} size={21} /><Text style={{ color: t.onAccent, fontWeight: '700', fontSize: 14 }}>Add log<Text style={{ fontWeight: '400', fontSize: 13 }}> · {section === 'Journal' && selected > today ? 'future date' : section === 'Journal' && selected < today ? new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'today'}</Text></Text></GrowPress></View>
    </View></View>
    {searchOpen && <Modal transparent visible animationType={reduced ? 'none' : 'slide'} onRequestClose={() => setSearchOpen(false)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: '#08110ccc' }}><SafeAreaView edges={['bottom', 'left', 'right']} style={{ width: '100%', maxWidth: 760, maxHeight: '94%', backgroundColor: t.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 22, fontWeight: '700', flex: 1 }}>Search journal</Text><GrowPress accessibilityRole="button" accessibilityLabel="Close journal search" onPress={() => setSearchOpen(false)} style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' }}><MaterialCommunityIcons name="close" size={22} color={t.text} /></GrowPress></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}><JournalSearch minimum={day.minimum} filters={searchFilters} onFilters={setSearchFilters} plantId={id} today={today} timeZone={plant.locationTimeZone} theme={t} onSelectEntry={entry => { day.jump(journalEntryDay(entry, plant.locationTimeZone)); positions.current.Journal = 0; scroll.current?.scrollTo({ y: 0, animated: false }); setSearchOpen(false); switchSection('Journal'); }} /></ScrollView>
    </SafeAreaView></KeyboardAvoidingView></Modal>}
    {!!composer && <PlantLogComposer timeZone={plant.locationTimeZone} plantId={id} entry={composer.entry} theme={t} name={plant.name} initialDate={composer.date} initialCategory={composer.category} onClose={() => setComposer(null)} onSave={saveLog} />}
    {deletingEntry && <ActionDialog title="Delete journal entry?" description="This removes the activity from its history and care calculations. This cannot be undone." confirmLabel="Delete entry" onClose={() => setDeletingEntry(null)} onConfirm={async () => { await deleteJournalEntry(id, deletingEntry.id, deletingEntry.mutationId); setRefresh(value => value + 1); setMessage('Entry deleted. Refresh search to update its results.'); }} />}
    {photoOpen && <PhotoComposer plantId={id} theme={t} onClose={() => setPhotoOpen(false)} onSaved={() => { setPhotoOpen(false); gallery.refresh(); switchSection('Photos'); setMessage('Progress photo added to your gallery.'); }} />}
    {editingSection && <PlantSectionEditor plantId={id} plant={plant} section={editingSection} onClose={() => setEditingSection(null)} onSaved={() => { setEditingSection(null); setRefresh(value => value + 1); setMessage('Plant details saved.'); }} />}
    <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={4000} style={{ bottom: 82 }}>{message}</Snackbar>
  </SafeAreaView>;
}
const s = StyleSheet.create({ toolbar: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 }, iconButton: { minWidth: 48, minHeight: 48, padding: 10 } });
