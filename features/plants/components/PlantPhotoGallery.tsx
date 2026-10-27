import PlantActionButton from './PlantActionButton';
import CloseButton from '@/ui/CloseButton';
import React from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { PlantImage as Image } from '@/ui/PlantImage';
import { GrowPress } from '@/ui/GrowMotion';
import { preparePlantPhoto } from '@/lib/plants/preparePlantPhoto';
import { useEditDraft, DraftRecovery } from '@/ui/useEditDraft';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import { newLogId } from '@/lib/logs/journalRepository';
import { manageProgressPic } from '@/lib/progressPics/manageProgressPic';
import { uploadProgressPic } from '@/lib/progressPics/uploadProgressPic';
import { plantDay } from '@/lib/dates/plantDay';
import ActionDialog from '@/ui/ActionDialog';
import type { ProgressPic } from '../hooks/useProgressGallery';
import type { PlantTheme } from './plantDetailTheme';
import { detailStyles as ds, SectionTitle } from './PlantDetailPanels';
import PlantEditorSheet from './PlantEditorSheet';
import PlantDateField, { displayDay } from './PlantDateField';
import { EditorField, EditorTheme } from './PlantEditorFields';
export const photoDay = (pic: ProgressPic, zone?: string | null) => pic.calendarDay || (pic.timestamp?.toDate ? plantDay(pic.timestamp.toDate(), pic.timeZone || zone) : '');
export async function pickProgressPhoto(source: 'camera' | 'library' = 'library') {
  if (Platform.OS !== 'web') {
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error(source === 'camera' ? 'Allow camera access to take a photo.' : 'Allow photo access to choose a photo.');
  }
  const options = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.8 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled || !result.assets[0] ? '' : (await preparePlantPhoto(result.assets[0].uri)).image;
}
export function PlantPhotoGallery({ plantId, pics, loading, error, theme: t, onAdd, onRefresh, onMore, hasMore, timeZone, highlightId, onPhotoLayout }: { plantId: string; pics: ProgressPic[]; loading: boolean; error: string; theme: PlantTheme; onAdd(): void; onRefresh(): void; onMore(): void; hasMore: boolean; timeZone?: string | null; highlightId?: string; onPhotoLayout?(id: string, y: number): void }) {
  const [selected, setSelected] = React.useState<ProgressPic | null>(null);
  const [caption, setCaption] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [menu, setMenu] = React.useState(false);
  const [comparing, setComparing] = React.useState(false);
  const [comparison, setComparison] = React.useState<ProgressPic | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const guard = useDiscardGuard(!!selected && editing && caption !== (selected.caption || ''));
  const close = () => guard.requestClose(() => { setSelected(null); setComparison(null); setComparing(false); setEditing(false); setMenu(false); });
  const window = useWindowDimensions();
  const action = async (kind: 'caption' | 'cover') => {
    if (!selected || busy) return;
    setBusy(true); setActionError('');
    try { await manageProgressPic(plantId, selected, kind, caption); if (kind === 'caption') { setSelected({ ...selected, caption: caption.trim() }); setEditing(false); } setMenu(false); onRefresh(); }
    catch (failure) { setActionError(failure instanceof Error ? failure.message : 'Could not save photo changes.'); }
    finally { setBusy(false); }
  };
  const textButton = (label: string, handler: () => void, danger = false) => <PlantActionButton label={label} theme={t} disabled={busy} danger={danger} icon={danger ? 'trash-can-outline' : /caption/i.test(label) ? 'pencil-outline' : /compar/i.test(label) ? 'compare' : /cover/i.test(label) ? 'image-outline' : /actions/i.test(label) ? 'dots-horizontal' : /retry/i.test(label) ? 'refresh' : 'chevron-down'} onPress={handler} />;
  return <View><SectionTitle theme={t} title="Progress photos" caption={loading && !pics.length ? undefined : `${pics.length}${hasMore ? '+' : ''} photos`} />
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
    {loading && !pics.length ? <ActivityIndicator color={t.accent} /> : !pics.length && !error ? <View style={{ paddingVertical: 32, gap: 12 }}><Text style={{ color: t.text, fontSize: 18, fontWeight: '600' }}>No progress photos yet</Text><Text style={{ color: t.muted, lineHeight: 21 }}>Add photos over time to see how your plant changes. Use Add photo below to start.</Text></View> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{pics.map(pic => <View key={pic.id} onLayout={event => onPhotoLayout?.(pic.id, event.nativeEvent.layout.y)} style={{ width: '47.8%' }}><GrowPress accessibilityRole="button" accessibilityLabel={`View photo ${displayDay(photoDay(pic, timeZone))}${pic.caption ? ': ' + pic.caption : ''}`} onPress={() => { setSelected(pic); setCaption(pic.caption || ''); setActionError(''); setMenu(false); }} style={{ borderRadius: 14, borderWidth: pic.id === highlightId ? 2 : 0, borderColor: t.accent, padding: pic.id === highlightId ? 3 : 0 }}><Image source={{ uri: pic.imageUrl }} style={{ width: '100%', aspectRatio: 0.9, borderRadius: 12, backgroundColor: t.surface }} />{pic.id === highlightId && <Text style={{ color: t.accent, marginTop: 6 }}>Selected photo</Text>}<Text style={{ color: t.muted, marginTop: 8 }}>{displayDay(photoDay(pic, timeZone))}</Text>{!!pic.caption && <Text numberOfLines={2} style={{ color: t.text, marginTop: 4 }}>{pic.caption}</Text>}</GrowPress></View>)}</View>}
    {(hasMore || !!error) && textButton(loading ? 'Loading…' : error ? 'Retry photos' : 'Load older photos', error ? onRefresh : onMore)}
    <Modal visible={!!selected} onRequestClose={() => { if (!busy) close(); }} animationType="fade"><EditorTheme.Provider value={t}><SafeAreaView style={{ flex: 1, backgroundColor: t.background, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: t.text, fontWeight: '600' }}>{selected ? displayDay(photoDay(selected, timeZone)) : ''}</Text><CloseButton label="Close photo" disabled={busy} onPress={close} color={t.text} /></View>
      {selected && <><View style={{ flex: 1, minHeight: 120, flexDirection: comparison && window.width >= 600 ? 'row' : 'column', gap: 10 }}><Image fullSize source={{ uri: selected.imageUrl }} resizeMode="contain" style={{ flex: 1 }} />{comparison && <View style={{ flex: 1 }}><Text style={{ color: t.muted }}>{displayDay(photoDay(comparison, timeZone))}</Text><Image fullSize source={{ uri: comparison.imageUrl }} resizeMode="contain" style={{ flex: 1 }} /></View>}</View>
      <ScrollView style={{ flexGrow: 0, maxHeight: '45%' }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
        {editing ? <><EditorField label="Photo caption" value={caption} onChangeText={setCaption} editable={!busy} multiline maxLength={1000} />{textButton(busy ? 'Saving…' : 'Save caption', () => void action('caption'))}{textButton('Cancel caption edit', () => guard.requestClose(() => { setCaption(selected.caption || ''); setEditing(false); }))}</> : <Text style={{ color: t.text, lineHeight: 21 }}>{selected.caption || 'No caption'}</Text>}
        {!editing && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{textButton('Edit caption', () => setEditing(true))}{textButton(comparing ? 'End comparison' : 'Compare', () => { setComparing(!comparing); setComparison(null); })}{textButton(menu ? 'Hide photo actions' : 'Photo actions', () => setMenu(!menu))}</View>}
        {menu && <View style={{ gap: 8 }}>{textButton('Use as cover', () => void action('cover'))}{textButton('Delete photo', () => setConfirmDelete(true), true)}</View>}
        {comparing && <><Text style={{ color: t.muted }}>Choose a photo to compare</Text><ScrollView horizontal contentContainerStyle={{ gap: 12 }}>{pics.filter(pic => pic.id !== selected.id).map(pic => <GrowPress key={pic.id} accessibilityRole="button" accessibilityLabel={`Compare photo from ${displayDay(photoDay(pic, timeZone))}`} onPress={() => setComparison(pic)} style={{ width: 92 }}><Image source={{ uri: pic.imageUrl }} style={{ width: 92, height: 76, borderRadius: 8 }} /><Text style={{ color: t.muted }}>{displayDay(photoDay(pic, timeZone))}</Text></GrowPress>)}</ScrollView>{pics.length < 2 && <Text style={{ color: t.muted }}>Add another progress photo to compare growth.</Text>}{hasMore && textButton('Load older comparison photos', onMore)}</>}
        {!!actionError && <Text accessibilityRole="alert" style={{ color: t.danger }}>{actionError}</Text>}
      </ScrollView></>}
      {confirmDelete && selected && <ActionDialog title="Delete photo?" description="This removes the photo and its linked journal entries. It clears the cover if this photo is selected. This cannot be undone." confirmLabel="Delete photo" onClose={() => setConfirmDelete(false)} onConfirm={async () => { await manageProgressPic(plantId, selected, 'delete'); guard.finish(() => { setSelected(null); setComparison(null); setConfirmDelete(false); onRefresh(); }); }} />}
      {guard.dialog}
    </SafeAreaView></EditorTheme.Provider></Modal>
  </View>;
}
export function PhotoComposer({ plantId, theme: t, onClose, onSaved, initialUri = '', initialDate, timeZone }: { plantId: string; theme: PlantTheme; onClose(): void; onSaved(id: string): void; initialUri?: string; initialDate?: string; timeZone?: string | null }) {
  const today = plantDay(new Date(), timeZone);
  const [uri, setUri] = React.useState(initialUri);
  const [date, setDate] = React.useState(initialDate || today);
  const [caption, setCaption] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const lock = React.useRef(false);
  const requestId = React.useRef(newLogId());
  const [error, setError] = React.useState('');
  const [stage, setStage] = React.useState<'preparing' | 'saving' | 'complete'>('preparing');
  const dirty = !!uri || !!caption.trim();
  const draft = useEditDraft(`plant.${plantId}.photo`, { uri, caption, date, requestId: requestId.current }, {}, dirty);
  const guard = useDiscardGuard(dirty, () => draft.clear());
  const close = () => guard.requestClose(() => { void draft.clear().catch(() => {}); onClose(); });
  const disabled = busy || picking || !draft.ready || !!draft.saved;
  const choose = async (source: 'camera' | 'library') => {
    if (disabled) return;
    setPicking(true); setError('');
    try { const image = await pickProgressPhoto(source); if (image) { setUri(image); requestId.current = newLogId(); } }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not select the photo.'); }
    finally { setPicking(false); }
  };
  const save = async () => {
    if (!uri || lock.current || disabled) return;
    lock.current = true; setBusy(true); setError('');
    try { const ref = await uploadProgressPic(plantId, uri, caption.trim(), requestId.current, setStage, date); await draft.clear().catch(() => {}); guard.finish(() => onSaved(ref.id)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Photo upload failed. Your selection is still here; retry.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <PlantEditorSheet title="Add photo" theme={t} busy={busy || picking} onClose={close} footer={<View style={{ gap: 8 }}>{!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}<GrowPress accessibilityRole="button" accessibilityLabel="Save progress photo" disabled={!uri || disabled} onPress={save} style={[ds.button, { backgroundColor: t.accent, opacity: !uri || disabled ? 0.5 : 1 }]}>{busy && <ActivityIndicator color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy ? stage === 'preparing' ? 'Preparing image…' : 'Saving photo…' : 'Save photo'}</Text></GrowPress></View>}>
    <DraftRecovery theme={t} draft={draft} apply={value => { setUri(value.uri); setCaption(value.caption); setDate(value.date || today); requestId.current = value.requestId; }} />
    {!!uri && <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: t.surface }} />}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><PlantActionButton label={picking ? 'Opening…' : uri ? 'Choose another photo' : 'Choose photo'} icon="image-outline" theme={t} disabled={disabled} onPress={() => void choose('library')} />{Platform.OS !== 'web' && <PlantActionButton label="Take photo" icon="camera-outline" theme={t} disabled={disabled} onPress={() => void choose('camera')} />}</View>
    <PlantDateField label="Taken on" value={date} onChange={setDate} today={today} disabled={disabled} />
    <EditorField label="Caption (optional)" value={caption} onChangeText={setCaption} editable={!disabled} multiline maxLength={1000} placeholder="What changed since the last photo?" />
    {guard.dialog}
  </PlantEditorSheet>;
}
