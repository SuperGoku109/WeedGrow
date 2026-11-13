import WateringCareCard from '../components/WateringCareCard';
import { careConfiguration } from '@/lib/careAlgorithm/outdoorContext';
import PlantActionButton from '../components/PlantActionButton';
import LoadError from '@/ui/LoadError';
import { useSession } from '@/services/session';
import { adviceInput } from '@/lib/suggestions/adviceInputs';
import { useMinuteClock } from '@/hooks/useMinuteClock';
import { usePlantAppearance } from '@/hooks/usePlantAppearance';
import PlantMovementHistory from '../components/PlantMovementHistory';
import { isCalendarDay, plantDay } from '@/lib/dates/plantDay';
import type { JournalSearchFilters } from '../components/JournalSearch';
import { useJournalDay } from '../hooks/useJournalDay';
import { journalEntryDay } from '../journalPresentation';
import React from 'react';
import { Animated, BackHandler, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNotice from '@/ui/AppNotice';
import { GrowPress, useReducedMotion, useSelectionIndicator } from '@/ui/GrowMotion';
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
import { JournalTimeline, JournalSectionTitle } from '../components/PlantJournal';
import JournalDateNavigator from '../components/JournalDateNavigator';
import DailyCareAdvice from '../components/DailyCareAdvice';
import LocalCareControls from '../components/LocalCareControls';
import { useLocalCareRevision } from '@/hooks/useLocalCareRevision';
import PlantLogComposer, { logChoices, type ActivitySaveOptions, type ActivitySaveResult } from '../components/PlantLogComposer';
import { PhotoComposer, PlantPhotoGallery, pickProgressPhoto } from '../components/PlantPhotoGallery';
import { presentCareCard, weatherFreshness } from '../plantCare';
import PlantLifecycle from '../components/PlantLifecycle';
import GrowthStageSummary from '../components/GrowthStageSummary';
import PlantWeather from '../components/PlantWeather';
import PlantEditorSheet from '../components/PlantEditorSheet';

type Section = 'Journal' | 'Photos' | 'Details';
const SECTIONS: Section[] = ['Journal', 'Photos', 'Details'];
export default function PlantDetailScreen() {
  const params = useLocalSearchParams<{ id: string; section?: string; fromGroupId?: string; welcome?: string; editSection?: string; journalDate?: string; managePlant?: string; returnToPlants?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const groupId = Array.isArray(params.fromGroupId) ? params.fromGroupId[0] : params.fromGroupId;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { plant, loading, error: plantError, refresh: retryPlant } = usePlant(id);
  const { user } = useSession();
  const uid = user?.uid;
  const { themeName } = usePlantAppearance();
  const t = plantThemes[themeName];
  const clock = useMinuteClock();
  const day = useJournalDay(id, plant?.locationTimeZone, clock, undefined);
  const { today, selected, dates, isToday, isFuture, backToToday, jump } = day;
  const [section, setSection] = React.useState<Section>(params.section === 'Photos' || params.section === 'Details' ? params.section : 'Journal');
  React.useEffect(() => { setSection(params.section === 'Photos' || params.section === 'Details' ? params.section : 'Journal'); if (params.section === 'Today') backToToday(); }, [id, params.section, backToToday]);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchFilters, setSearchFilters] = React.useState<JournalSearchFilters>({ text: '', category: 'all', start: '', end: '', datesOpen: false });
  React.useEffect(() => setSearchFilters({ text: '', category: 'all', start: '', end: '', datesOpen: false }), [id]);
  const [composer, setComposer] = React.useState<{ category?: JournalCategory; date: string; entry?: JournalEntry; origin: Section; context?: 'soil-check' } | null>(null);
  const [deletingEntry, setDeletingEntry] = React.useState<JournalEntry | null>(null);
  const [harvestDate, setHarvestDate] = React.useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [photoUri, setPhotoUri] = React.useState('');
  const [hasPhotoDraft, setHasPhotoDraft] = React.useState(false);
  React.useEffect(() => { let active = true; setHasPhotoDraft(false); if (uid && !photoOpen) void AsyncStorage.getItem(`weedgrow.edit.v1.${uid}.plant.${id}.photo`).then(raw => { if (active) setHasPhotoDraft(!!raw); }).catch(() => {}); return () => { active = false; }; }, [id, uid, photoOpen]);
  const [returnToSearch, setReturnToSearch] = React.useState(false);
  const [pickingPhoto, setPickingPhoto] = React.useState(false);
  const [newPhotoId, setNewPhotoId] = React.useState('');
  const [focusedEntry, setFocusedEntry] = React.useState('');
  const [highlightLabel, setHighlightLabel] = React.useState('Selected activity');
  const [manageOpen, setManageOpen] = React.useState(false);
  const anchors = React.useRef<Record<string, number>>({});
  const bodyTop = React.useRef(0);
  const railHeight = React.useRef(0);
  const journalTop = React.useRef(0);
  const timelineTop = React.useRef(0);
  const pendingAnchor = React.useRef('');
  const scrollToAnchor = (key: string) => {
    pendingAnchor.current = key;
    const y = anchors.current[key];
    if (y == null) return;
    const target = Math.max(0, bodyTop.current + y - railHeight.current - 12);
    positions.current[section] = target;
    restoring.current = false;
    scroll.current?.scrollTo({ y: target, animated: !reduced });
    pendingAnchor.current = '';
  };
  const rememberAnchor = (key: string, y: number) => { anchors.current[key] = y; if (pendingAnchor.current === key) scrollToAnchor(key); };
  const addPhoto = async () => {
    if (pickingPhoto) return;
    setPhotoUri('');
    if (hasPhotoDraft) { setPhotoOpen(true); return; }
    if (Platform.OS !== 'web') { setPhotoOpen(true); return; }
    setPickingPhoto(true);
    try { const uri = await pickProgressPhoto(); if (uri) { setPhotoUri(uri); setPhotoOpen(true); } }
    catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Could not open photos. Try again.'); }
    finally { setPickingPhoto(false); }
  };
  const [showWelcome, setShowWelcome] = React.useState(params.welcome === '1');
  React.useEffect(() => { if (params.editSection && plant) { setSection('Details'); router.setParams({ editSection: undefined }); router.push({ pathname: '/plant/[id]/edit', params: { id, theme: themeName } }); } }, [params.editSection, plant, router, id, themeName]);
  React.useEffect(() => { setShowWelcome(params.welcome === '1'); }, [id, params.welcome]);
  const [message, setMessage] = React.useState('');
  React.useEffect(() => { setNewPhotoId(''); setFocusedEntry(''); setReturnToSearch(false); setPhotoOpen(false); setComposer(null); setHarvestDate(null); anchors.current = {}; pendingAnchor.current = ''; }, [id]);
  React.useEffect(() => { if (params.managePlant === '1' && plant) { setSection('Details'); setManageOpen(true); pendingAnchor.current = 'Manage plant'; router.setParams({ managePlant: undefined }); } }, [params.managePlant, plant, router]);
  const [refresh, setRefresh] = React.useState(0);
  const localCareRevision = useLocalCareRevision();
  const [cards, setCards] = React.useState<SuggestionCard[]>([]);
  const [insightLoading, setInsightLoading] = React.useState(false);
  const [insightError, setInsightError] = React.useState('');
  const scroll = React.useRef<ScrollView>(null);
  const positions = React.useRef<Record<Section, number>>({ Journal: 0, Photos: 0, Details: 0 });
  const tabSelection = useSelectionIndicator(section);
  const tabFocusPosition = React.useRef<{ section: Section; y: number } | null>(null);
  React.useEffect(() => { positions.current = { Journal: 0, Photos: 0, Details: 0 }; }, [id]);
  const restoring = React.useRef(false);
  React.useLayoutEffect(() => { restoring.current = true; }, [section, id]);
  const [bannerHeight, setBannerHeight] = React.useState(0);
  const [railPinned, setRailPinned] = React.useState(false);
  const pinned = React.useRef(false);
  const data = usePlantJournalData(id, dates[0], dates[dates.length - 1], plant?.locationTimeZone, section === 'Journal');
  const gallery = useProgressGallery(id, section === 'Photos', newPhotoId || undefined);
  React.useEffect(() => {
    if (!restoring.current || (section === 'Journal' && (data.loading || insightLoading)) || (section === 'Photos' && gallery.loading)) return;
    const timer = setTimeout(() => { scroll.current?.scrollTo({ y: positions.current[section], animated: false }); restoring.current = false; }, 0);
    return () => clearTimeout(timer);
  }, [section, data.loading, gallery.loading, insightLoading]);
  const todayLogs = data.logs[today] || [];
  const activitySignature = todayLogs.filter(log => log.type === 'watering' || log.moistureState || log.rainfallObservation || log.category === 'pests').map(log => `${log.id}:${log.mutationId || log.timestamp?.toMillis?.()}`).sort().join(',');
  const adviceKey = JSON.stringify(plant ? adviceInput({ ...plant, id }) : null);
  const adviceWeatherTime = data.weather[today]?.fetchedAt?.toMillis?.();

  const hasLocation = typeof plant?.location?.lat === 'number' && typeof plant?.location?.lng === 'number';
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
    if (adviceKey === 'null' || !id || (section !== 'Journal' || !isToday)) { setInsightLoading(false); return; }
    setInsightLoading(true);
    if (data.loading || data.weatherLoading) return () => controller.abort();
    evaluateSuggestionCardsForPlant(JSON.parse(adviceKey), { execution: 'local' }, controller.signal).then(result => { if (!cancelled) setCards(result?.cards || []); })
      .catch(() => { if (!cancelled) setInsightError('Care suggestions could not be refreshed.'); })
      .finally(() => { if (!cancelled) setInsightLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [adviceKey, id, hasLocation, today, activitySignature, refresh, section, isToday, adviceWeatherTime, data.loading, data.weatherLoading, localCareRevision]);
  React.useEffect(() => {
    if (section !== 'Journal' || !isToday || insightLoading) return;
    const due = Math.min(...cards.flatMap(card => card.metrics.observationDriven && typeof card.metrics.expiresAtUtc === 'number' ? [card.metrics.expiresAtUtc] : []));
    if (!Number.isFinite(due)) return;
    const timer = setTimeout(() => setRefresh(value => value + 1), Math.max(1000, due * 1000 - Date.now() + 25));
    return () => clearTimeout(timer);
  }, [cards, section, isToday, insightLoading]);
  const openGrowth = () => router.push({ pathname: '/plant/[id]/growth', params: { id, theme: themeName } });
  const editPlant = () => router.push({ pathname: '/plant/[id]/edit', params: { id, theme: themeName } });
  const switchSection = (next: Section) => {
    setFocusedEntry('');
    // Focusing a sticky tab can scroll its original layout box into view on web.
    // Keep that focus movement from replacing the outgoing reading position.
    if (tabFocusPosition.current?.section === section) positions.current[section] = tabFocusPosition.current.y;
    tabFocusPosition.current = null;
    setSection(next);
    // Restore the destination's own position after its content mounts.
  };
  const openLog = (category?: JournalCategory, context?: 'soil-check') => {
    if (plant?.status !== 'active' || section === 'Journal' && isFuture) return;
    const date = section === 'Journal' ? selected : today;
    setComposer({ category, date: date > today ? today : date, origin: section, context });
  };
  const saveLog = async (category: JournalCategory, description: string, date: string, measurements: Partial<LogInput>, requestId: string, options?: ActivitySaveOptions) => {
    return saveJournalEntry(id, { ...buildManualPlantLog(category, description), ...measurements }, date, options ? options.entry : composer?.entry, requestId, options?.baseline);
  };
  const logSaved = (saved: ActivitySaveResult, category: JournalCategory, date: string, edited: boolean) => {
    const currentDay = plantDay(new Date(), plant?.locationTimeZone);
    const keepPosition = section === 'Journal' && date === selected;
    day.select(date, currentDay); setSection('Journal'); setComposer(null); setRefresh(value => value + 1);
    setHighlightLabel(edited ? 'Activity updated' : 'Activity saved'); setFocusedEntry(saved.id); pendingAnchor.current = saved.id;
    setMessage(`${logChoices.find(choice => choice.key === category)?.label || 'Activity'} ${edited ? 'updated' : 'recorded'} for ${date === currentDay ? 'today' : new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`);
    if (!keepPosition) { positions.current.Journal = 0; scroll.current?.scrollTo({ y: 0, animated: !reduced }); }
  };
  const editEntry = (entry: JournalEntry) => { const category = journalCategory(entry); if (['watering', 'feeding', 'pests', 'training', 'health', 'measurements', 'repotting', 'flushing', 'notes'].includes(category)) setComposer({ entry, category: category as JournalCategory, date: entry.calendarDay || plantDay(entry.timestamp.toDate(), entry.timeZone || plant?.locationTimeZone), origin: 'Journal' }); };
  if (loading) return <LoadingView onBack={goBack} />;
  if (!plant && plantError) return <LoadError message={plantError} onRetry={retryPlant} onBack={goBack} />;
  if (!plant) return <NotFoundView />;
  const selectedLogs = data.logs[selected] || [];
    const displayCards = cards.map(card => presentCareCard(card, todayLogs.some(log => log.type === 'watering'), card.algorithmVersion.startsWith('hops-') ? false : weatherFreshness(data.weather[today]).stale, clock)).filter(card => card.active);
  const backLabel = groupId && params.returnToPlants !== '1' ? 'Back to garden' : 'Back to plants';
  const dayLabel = new Date(`${selected}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.background }}>
    <View style={[s.toolbar, { borderBottomColor: t.border }]}>
      <GrowPress accessibilityRole="button" accessibilityLabel={backLabel} onPress={goBack} style={[s.iconButton, { width: 'auto', paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }]}><MaterialCommunityIcons name="arrow-left" size={22} color={t.text} /><Text style={{ color: t.text, fontSize: 15 }}>{groupId && params.returnToPlants !== '1' ? 'Garden' : 'Plants'}</Text></GrowPress>
      <View style={{ flex: 1, minWidth: 0 }}>{railPinned && width >= 400 && <Text numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: '600' }}>{plant.name}</Text>}</View>
    </View>
    <ScrollView ref={scroll} stickyHeaderIndices={[1]} showsVerticalScrollIndicator={false} scrollEventThrottle={16} onScrollBeginDrag={() => { restoring.current = false; tabFocusPosition.current = null; }} onContentSizeChange={() => { if (restoring.current && (section !== 'Journal' || (!data.loading && !insightLoading)) && (section !== 'Photos' || !gallery.loading)) scroll.current?.scrollTo({ y: positions.current[section], animated: false }); }} onScroll={event => { if (restoring.current && Math.abs(event.nativeEvent.contentOffset.y - positions.current[section]) < 1) restoring.current = false; if (!restoring.current) positions.current[section] = event.nativeEvent.contentOffset.y; const next = bannerHeight > 0 && event.nativeEvent.contentOffset.y >= bannerHeight; if (next !== pinned.current) { pinned.current = next; setRailPinned(next); } }} contentContainerStyle={{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingBottom: 26 }}>
      <View onLayout={event => setBannerHeight(event.nativeEvent.layout.height)} style={{ paddingHorizontal: 18, paddingTop: 4 }}><PlantBanner plant={plant} theme={t} onEdit={editPlant} /></View>
      <View onLayout={event => { railHeight.current = event.nativeEvent.layout.height; }} style={{ paddingHorizontal: 18, paddingBottom: 8, backgroundColor: t.background }}><View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: t.surface, borderWidth: 1, borderTopWidth: railPinned ? 1 : 0, borderColor: t.border, borderTopLeftRadius: railPinned ? 20 : 0, borderTopRightRadius: railPinned ? 20 : 0, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, padding: 4, paddingTop: 4 }}><Animated.View pointerEvents="none" style={[tabSelection.indicatorStyle, { backgroundColor: t.accent, borderRadius: 12 }]} />{SECTIONS.map(item => <View key={item} onLayout={event => tabSelection.onItemLayout(item, event)} style={{ flex: 1, minWidth: 0 }}><GrowPress accessibilityRole="tab" hitSlop={{ top: 4, bottom: 4 }} onFocus={() => { if (item !== section) tabFocusPosition.current = { section, y: positions.current[section] }; }} aria-selected={section === item} accessibilityState={{ selected: section === item }} onPress={() => switchSection(item)} style={{ alignItems: 'center', minHeight: 40, justifyContent: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: 'transparent' }}><Text style={{ color: section === item ? t.onAccent : t.muted, fontSize: 13, fontWeight: '700' }}>{item === 'Details' ? 'Plant info' : item}</Text></GrowPress></View>)}</View></View>
      <View onLayout={event => { bodyTop.current = event.nativeEvent.layout.y; }} style={{ paddingHorizontal: 18, paddingBottom: 20 }}>
        {section === 'Journal' && !!data.weatherError && <GrowPress accessibilityRole="button" onPress={data.retry} style={{ minHeight: 48, justifyContent: 'center', marginTop: 12 }}><Text accessibilityRole="alert" style={{ color: t.danger }}>{data.weatherError} Tap to retry.</Text></GrowPress>}
        {showWelcome && <View style={{ marginTop: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: t.border, gap: 8 }}><Text style={{ color: t.text, fontWeight: '600' }}>Plant added. Your setup is saved.</Text><Text style={{ color: t.muted }}>Your journal is ready whenever you have something to record.</Text><PlantActionButton label="Got it" icon="check" theme={t} onPress={() => { setShowWelcome(false); router.setParams({ welcome: '' }); }} /></View>}
        {section === 'Journal' && <View onLayout={event => { journalTop.current = event.nativeEvent.layout.y; }}>
          {returnToSearch && <GrowPress accessibilityRole="button" onPress={() => setSearchOpen(true)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Back to search results</Text></GrowPress>}
          <JournalDateNavigator today={today} selected={selected} dates={dates} logs={data.logs} historyStatus={data.loading ? 'loading' : data.error ? 'error' : 'ready'} theme={t} minimum={day.minimum} canGoBack={day.canGoBack} onSelect={day.select} onJump={day.jump} onMove={day.moveWeek} onToday={day.backToToday} onSearch={() => setSearchOpen(true)} />
          {isToday && <><DailyCareAdvice key={id} cards={displayCards} loading={insightLoading || data.loading || data.weatherLoading} error={insightError} hasLocation={hasLocation} theme={t} onRecord={(category, context) => openLog(category, context)} canRecord={plant.status === 'active'} onRefresh={() => setRefresh(value => value + 1)} /></>}
          <JournalSectionTitle title={isToday ? 'Recorded today' : isFuture ? dayLabel : 'Recorded'} theme={t} caption={isFuture ? 'FORECAST' : data.loading ? undefined : data.error ? 'Unavailable' : selectedLogs.length ? selectedLogs.length + (selectedLogs.length === 1 ? ' entry' : ' entries') : undefined} />
          {!isFuture && <View onLayout={event => { timelineTop.current = event.nativeEvent.layout.y; }}><JournalTimeline key={'activity:' + selected} compactEmpty emptyMessage={isToday ? 'Nothing recorded today.' : 'No activity recorded on this day.'} logs={selectedLogs} loading={data.loading} error={data.error} theme={t} timeZone={plant.locationTimeZone} onEdit={editEntry} onDelete={setDeletingEntry} highlightedId={focusedEntry} highlightLabel={highlightLabel} onRetry={data.retry} onViewPhoto={entry => { const photoId = entry.id.startsWith('photo_') ? entry.id.slice(6) : entry.id === 'setup-photo' ? entry.id : ''; setNewPhotoId(photoId); switchSection('Photos'); pendingAnchor.current = photoId; }} onEntryLayout={(entryId, y) => rememberAnchor(entryId, journalTop.current + timelineTop.current + y)} /></View>}
          {isFuture && <Text style={[ds.body, { color: t.muted }]}>Forecast only. Choose today or an earlier date to record completed activities.</Text>}
          {isToday && <><View style={{ marginTop: 24 }}><GrowthStageSummary key={'growth:' + id} plant={plant} theme={t} now={clock} onPress={openGrowth} /></View><LocalCareControls compact key={'local:' + id} plantId={id} plant={plant} theme={t} onEditSetup={editPlant} /></>}
          <SectionTitle title={isToday ? 'Conditions' : isFuture ? 'Forecast conditions' : 'Saved conditions'} theme={t} />
          <PlantWeather key={'conditions:' + selected} compact={isToday} theme={t} plantId={id} plant={plant} date={selected} weather={data.weather[selected]} savedError={data.weatherDayErrors?.[selected]} savedLoading={data.weatherLoading} />
        </View>}
        {section === 'Photos' && <PlantPhotoGallery plantId={id} hasMore={gallery.hasMore} onMore={() => void gallery.loadMore()} onRefresh={gallery.refresh} pics={gallery.pics} loading={gallery.loading} error={gallery.error} theme={t} onAdd={() => void addPhoto()} timeZone={plant.locationTimeZone} highlightId={newPhotoId} onPhotoLayout={(photoId, y) => rememberAnchor(photoId, y)} />}
        <View key={'profile:' + id} style={{ display: section === 'Details' ? 'flex' : 'none' }}>{section === 'Details' && <GrowthStageSummary key={'growth-details:' + id} plant={plant} theme={t} now={clock} onPress={openGrowth} />}{section === 'Details' && <WateringCareCard key={'water-chart:' + id} plant={plant} theme={t} />}<PlantDetails plant={plant} theme={t} onSectionLayout={rememberAnchor} highlightedSection={focusedEntry} locationHistory={<PlantMovementHistory plantId={id} theme={t} active={section === 'Details'} />} />{section === 'Details' && <LocalCareControls plantId={id} plant={plant} theme={t} onEditSetup={editPlant} />}<View onLayout={event => rememberAnchor("Manage plant", event.nativeEvent.layout.y)}><PlantLifecycle plantId={id} plant={plant} theme={t} open={manageOpen} onClose={() => setManageOpen(false)} onDeleted={goBack} onSaved={value => { setMessage(value); setRefresh(previous => previous + 1); }} /></View></View>
      </View>
    </ScrollView>
    {section !== 'Details' && <View style={{ backgroundColor: t.background, borderTopWidth: 1, borderColor: t.border, paddingBottom: Math.max(12, insets.bottom), paddingTop: 10, paddingHorizontal: 18 }}><View style={{ width: '100%', maxWidth: 724, alignSelf: 'center', gap: 8 }}>
      {plant.status !== 'active' && section === 'Journal' ? <GrowPress accessibilityRole="button" onPress={() => { switchSection('Details'); setManageOpen(true); pendingAnchor.current = 'Manage plant'; setTimeout(() => scrollToAnchor('Manage plant'), 0); }} style={[ds.button, { backgroundColor: t.surface }]}><Text style={{ color: t.accent }}>Manage {plant.status} plant</Text></GrowPress> : <View style={{ flexDirection: 'row', gap: 8 }}>
        {section === 'Journal' && <GrowPress accessibilityRole="button" accessibilityLabel="Add photo" disabled={pickingPhoto} onPress={() => void addPhoto()} style={[ds.button, { backgroundColor: t.surface, paddingHorizontal: 12 }]}><MaterialCommunityIcons name="camera-plus-outline" color={t.accent} size={20} /><Text style={{ color: t.accent }}>Photo</Text></GrowPress>}
        {section === 'Photos' && plant.status === 'active' && <GrowPress accessibilityRole="button" onPress={() => openLog()} style={[ds.button, { backgroundColor: t.surface, paddingHorizontal: 12 }]}><Text style={{ color: t.accent }}>Log today</Text></GrowPress>}
        <View style={{ flex: 1 }}><GrowPress accessibilityRole="button" accessibilityLabel={section === 'Photos' ? 'Add photo' : 'Add activity'} disabled={pickingPhoto || section === 'Journal' && isFuture} onPress={() => section === 'Photos' ? void addPhoto() : openLog()} style={[ds.button, { backgroundColor: t.accent, opacity: pickingPhoto || section === 'Journal' && isFuture ? 0.5 : 1 }]}><Text style={{ color: t.onAccent, fontWeight: '700' }}>{section === 'Photos' ? pickingPhoto ? 'Opening photos…' : 'Add photo' : isFuture ? 'Future date · viewing only' : 'Add activity'}</Text></GrowPress></View>
      </View>}
    </View></View>}
    {searchOpen && <PlantEditorSheet title="Search journal" theme={t} onClose={() => setSearchOpen(false)}><JournalSearch minimum={day.minimum} filters={searchFilters} onFilters={setSearchFilters} plantId={id} today={today} timeZone={plant.locationTimeZone} theme={t} onSelectEntry={entry => { const date = journalEntryDay(entry, plant.locationTimeZone); day.jump(date); setSection('Journal'); setReturnToSearch(true); setHighlightLabel('Search result'); setFocusedEntry(entry.id); pendingAnchor.current = entry.id; setSearchOpen(false); setTimeout(() => scrollToAnchor(entry.id), 0); }} /></PlantEditorSheet>}
    {!!composer && <PlantLogComposer onHarvest={date => { setComposer(null); setHarvestDate(date); }} wateringRepeat={plant.wateringRepeat} configuration={careConfiguration(plant)} key={id + (composer.entry?.id || ":new")} initialContext={composer.context} knownWaterings={Object.fromEntries(Object.entries(data.logs).flatMap(([date, logs]) => { const watering = logs.find(log => log.type === 'watering'); return watering ? [[date, watering]] : []; }))} timeZone={plant.locationTimeZone} plantId={id} entry={composer.entry} theme={t} name={plant.name} initialDate={composer.date} initialCategory={composer.category} onClose={() => setComposer(null)} onOpenEntry={entry => { day.jump(journalEntryDay(entry, plant.locationTimeZone)); setSection('Journal'); editEntry(entry); }} onViewDay={date => { day.jump(date); setSection('Journal'); setComposer(null); setMessage('Showing the saved activity.'); }} onSave={saveLog} onSaved={logSaved} />}
    {harvestDate && <PlantLifecycle harvestOnly initialDate={harvestDate} plantId={id} plant={plant} theme={t} onDeleted={goBack} onClose={() => setHarvestDate(null)} onSaved={value => { setHarvestDate(null); setMessage(value); setRefresh(previous => previous + 1); }} />}
    {deletingEntry && <ActionDialog title="Delete journal entry?" description="This removes the activity from its history and care calculations. This cannot be undone." confirmLabel="Delete entry" onClose={() => setDeletingEntry(null)} onConfirm={async () => { await deleteJournalEntry(id, deletingEntry.id, deletingEntry); setRefresh(value => value + 1); setMessage('Activity deleted.'); }} />}
    {photoOpen && <PhotoComposer plantId={id} initialUri={photoUri} initialDate={section === 'Journal' && !isFuture ? selected : today} timeZone={plant.locationTimeZone} theme={t} onClose={() => setPhotoOpen(false)} onSaved={photoId => { setPhotoOpen(false); setNewPhotoId(photoId); gallery.refresh(); switchSection('Photos'); pendingAnchor.current = photoId; setMessage('Photo added to your gallery.'); }} />}
    <AppNotice visible={!!message} onDismiss={() => setMessage('')} duration={4000} style={{ bottom: 82 }}>{message}</AppNotice>
  </SafeAreaView>;
}
const s = StyleSheet.create({ toolbar: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, gap: 8 }, iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' } });
