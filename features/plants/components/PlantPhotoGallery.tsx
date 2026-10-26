import { preparePlantPhoto } from '@/lib/plants/preparePlantPhoto';
import { useEditDraft, DraftRecovery } from '@/ui/useEditDraft';
import { PlantImage as Image } from '@/ui/PlantImage';
import React from 'react';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import { newLogId } from '@/lib/logs/journalRepository';
import { manageProgressPic } from '@/lib/progressPics/manageProgressPic';
import ActionDialog from '@/ui/ActionDialog';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GrowPress, GrowReveal, useReducedMotion } from '@/ui/GrowMotion';
import { uploadProgressPic } from '@/lib/progressPics/uploadProgressPic';
import type { ProgressPic } from '../hooks/useProgressGallery';
import { detailStyles as ds, EmptyCard, SectionTitle } from './PlantDetailPanels';
import type { PlantTheme } from './plantDetailTheme';
export function PlantPhotoGallery({ plantId, pics, loading, error, theme: t, onAdd, onRefresh, onMore, hasMore }: { plantId: string; onRefresh: () => void; onMore: () => void; hasMore: boolean; pics: ProgressPic[]; loading: boolean; error: string; theme: PlantTheme; onAdd: () => void }) {
  const [selected, setSelected] = React.useState<ProgressPic | null>(null);
  const [caption, setCaption] = React.useState('');
  const [actionError, setActionError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [comparison, setComparison] = React.useState<ProgressPic | null>(null);
  const captionGuard = useDiscardGuard(!!selected && caption !== (selected.caption || ''));
  const closePhoto = () => captionGuard.requestClose(() => { setSelected(null); setComparison(null); });
  const reduced = useReducedMotion();
  const window = useWindowDimensions();
  return <GrowReveal><SectionTitle theme={t} title="Progress photos" caption={loading && !pics.length ? undefined : `${pics.length} ${pics.length === 1 ? 'photo' : 'photos'} loaded`} />
    {error || (loading && !pics.length) ? <EmptyCard theme={t} title={error ? 'Photos unavailable' : 'Loading photos…'} text={error || 'Gathering your progress photos.'} /> : !pics.length ? <View style={[ds.card, { backgroundColor: t.surface, borderColor: t.border, alignItems: 'center', paddingVertical: 32 }]}><MaterialCommunityIcons name="image-outline" size={36} color={t.muted} /><Text style={{ color: t.text, fontSize: 18, fontWeight: '600', marginTop: 16 }}>No progress photos yet</Text><Text style={[ds.body, { color: t.muted, textAlign: 'center', marginTop: 8, marginBottom: 20 }]}>Add photos over time to see how your plant changes.</Text><GrowPress accessibilityRole="button" onPress={onAdd} style={[ds.button, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name="camera-plus-outline" size={20} color={t.accent} /><Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>Add first photo</Text></GrowPress></View> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{pics.map(pic => <View key={pic.id} style={{ width: '47.8%' }}><GrowPress accessibilityRole="button" accessibilityLabel={`View photo ${pic.caption || pic.timestamp?.toDate?.().toLocaleDateString() || ''}`} onPress={() => { setSelected(pic); setCaption(pic.caption || ''); setActionError(''); }}><Image source={{ uri: pic.imageUrl }} style={{ width: '100%', aspectRatio: 0.9, borderRadius: 19, backgroundColor: t.elevated }} /><Text style={{ color: t.muted, fontSize: 14, marginTop: 8 }}>{pic.timestamp?.toDate?.().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) || 'Just added'}</Text>{!!pic.caption && <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, marginTop: 4 }}>{pic.caption}</Text>}</GrowPress></View>)}</View>}
    <GrowPress accessibilityRole="button" disabled={loading} onPress={hasMore ? onMore : onRefresh} style={{ padding: 14 }}><Text style={{ color: t.accent }}>{loading ? 'Loading…' : hasMore ? 'Load older photos' : 'Refresh gallery'}</Text></GrowPress>
    <Modal visible={!!selected} onRequestClose={() => { if (!busy) closePhoto(); }} animationType={reduced ? 'none' : 'fade'}><SafeAreaView style={{ flex: 1, backgroundColor: t.background, padding: 18 }}><GrowPress accessibilityRole="button" accessibilityLabel="Close photo" disabled={busy} onPress={closePhoto} style={{ alignSelf: 'flex-end', padding: 12 }}><MaterialCommunityIcons name="close" size={24} color={t.text} /></GrowPress>{selected && <><View style={{ flex: 1, flexDirection: comparison && window.width >= 600 ? 'row' : 'column', gap: 10 }}><View style={{ flex: 1 }}><Text style={{ color: t.muted, fontWeight: '600' }}>First photo · {selected.timestamp?.toDate?.().toLocaleDateString()}</Text><Image fullSize source={{ uri: selected.imageUrl }} resizeMode="contain" style={{ flex: 1, minHeight: 150 }} /></View>{comparison && <View style={{ flex: 1 }}><Text style={{ color: t.muted, fontWeight: '600' }}>Compare with · {comparison.timestamp?.toDate?.().toLocaleDateString()}</Text><Image fullSize source={{ uri: comparison.imageUrl }} resizeMode="contain" style={{ flex: 1, minHeight: 150 }} /></View>}</View><Text style={{ color: t.text, paddingVertical: 18 }}>{selected.timestamp?.toDate?.().toLocaleDateString()}</Text><TextInput accessibilityLabel="Edit photo caption" value={caption} onChangeText={setCaption} maxLength={1000} editable={!busy} style={{ color: t.text, padding: 12, borderWidth: 1, borderColor: t.border, borderRadius: 12 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{(['caption', 'cover'] as const).map(action => <GrowPress key={action} accessibilityRole="button" disabled={busy} onPress={async () => { setBusy(true); setActionError(''); try { await manageProgressPic(plantId, selected, action, caption); captionGuard.finish(() => { setSelected(null); onRefresh(); }); } catch (err) { setActionError(err instanceof Error ? err.message : 'Could not save photo changes.'); } finally { setBusy(false); } }} style={{ padding: 12 }}><Text style={{ color: t.accent }}>{action === 'caption' ? 'Save caption' : 'Use as cover'}</Text></GrowPress>)}<GrowPress accessibilityRole="button" disabled={busy} onPress={() => setConfirmDelete(true)} style={{ padding: 12 }}><Text style={{ color: t.danger }}>Delete photo</Text></GrowPress></View>
      {comparison && <GrowPress accessibilityRole="button" onPress={() => setComparison(null)} style={{ padding: 12 }}><Text style={{ color: t.accent }}>End comparison</Text></GrowPress>}
      <ScrollView horizontal style={{ maxHeight: 64 }}>{pics.filter(pic => pic.id !== selected.id).map(pic => <GrowPress accessibilityRole="button" key={pic.id} onPress={() => setComparison(pic)} style={{ padding: 12 }}><Text style={{ color: t.accent }}>Compare {pic.timestamp?.toDate?.().toLocaleDateString()}</Text></GrowPress>)}</ScrollView>
      {!!actionError && <Text accessibilityRole="alert" style={{ color: t.danger }}>{actionError}</Text>}
      {confirmDelete && <ActionDialog title="Delete photo?" description="This removes the photo and its linked photo journal entries. It also clears this cover image if selected. This cannot be undone." confirmLabel="Delete photo" onClose={() => setConfirmDelete(false)} onConfirm={async () => { await manageProgressPic(plantId, selected, 'delete'); captionGuard.finish(() => { setSelected(null); setComparison(null); onRefresh(); }); }} />}
    </>}{captionGuard.dialog}</SafeAreaView></Modal>
  </GrowReveal>;
}
export function PhotoComposer({ plantId, theme: t, onClose, onSaved }: { plantId: string; theme: PlantTheme; onClose: () => void; onSaved: () => void }) {
  const [uri, setUri] = React.useState('');
  const [caption, setCaption] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const lock = React.useRef(false);
  const requestId = React.useRef(newLogId());
  const [error, setError] = React.useState('');
  const [stage, setStage] = React.useState<'preparing' | 'saving' | 'complete'>('preparing');
  const draft = useEditDraft(`plant.${plantId}.photo`, { uri, caption, requestId: requestId.current }, {}, !!uri || !!caption.trim());
  const guard = useDiscardGuard(!!uri || !!caption.trim(), () => draft.clear());
  const close = () => { void draft.clear().catch(() => {}); onClose(); };
  const reduced = useReducedMotion();
  const choose = async () => {
    if (picking) return;
    setPicking(true); setError('');
    try {
      if (Platform.OS !== 'web') { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) { setError('Allow photo access to choose a progress picture.'); return; } }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled && result.assets[0]) { const compact = await preparePlantPhoto(result.assets[0].uri); requestId.current = newLogId(); setUri(compact.image); }
    } catch { setError('Could not open the photo library. Please try again.'); }
    finally { setPicking(false); }
  };
  const save = async () => {
    if (!uri || lock.current || !draft.ready || draft.saved) return;
    lock.current = true; setBusy(true); setError('');
    try { await uploadProgressPic(plantId, uri, caption.trim(), requestId.current, setStage); await draft.clear().catch(() => {}); guard.finish(onSaved); }
    catch { setError('Photo upload failed. Your selection is still here; please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal transparent visible animationType={reduced ? 'none' : 'slide'} onRequestClose={() => { if (!busy) guard.requestClose(close); }}><SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(8,17,12,0.75)', justifyContent: 'flex-end', alignItems: 'center' }}><View style={{ width: '100%', maxWidth: 620, maxHeight: '95%', backgroundColor: t.background, borderRadius: 27, padding: 20 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}><Text style={[ds.title, { color: t.text }]}>Add progress photo</Text><GrowPress accessibilityRole="button" accessibilityLabel="Close photo form" disabled={busy || picking} onPress={() => guard.requestClose(close)} style={{ padding: 10 }}><MaterialCommunityIcons name="close" color={t.text} size={22} /></GrowPress></View>
    <ScrollView keyboardShouldPersistTaps="handled">
      <DraftRecovery draft={draft} apply={value => { setUri(value.uri); setCaption(value.caption); requestId.current = value.requestId; }} />
      {uri ? <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 220, backgroundColor: t.surface, borderRadius: 20 }} /> : <EmptyCard theme={t} title="Choose a progress photo" text="Choose a photo, add a caption, then save it to this plant’s gallery." />}
      <GrowPress accessibilityRole="button" disabled={busy || picking} onPress={choose} style={[ds.button, { backgroundColor: t.elevated, marginTop: 14 }]}><MaterialCommunityIcons name="image-plus" size={20} color={t.accent} /><Text style={{ color: t.accent }}>{picking ? 'Opening library…' : uri ? 'Choose a different photo' : 'Choose photo'}</Text></GrowPress>
      <Text style={{ color: t.text, marginTop: 20, marginBottom: 10, fontSize: 14 }}>Caption (optional)</Text><TextInput accessibilityLabel="Photo caption" value={caption} onChangeText={setCaption} editable={!busy} multiline maxLength={1000} placeholder="New leaves, a little stretch, the first flower…" placeholderTextColor={t.muted} style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 15, padding: 15, minHeight: 75, color: t.text, textAlignVertical: 'top' }} />
      {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, marginTop: 12 }}>{error}</Text>}
    </ScrollView>
    {busy && <Text accessibilityLiveRegion="polite" style={{ color: t.muted, paddingVertical: 10 }}>{stage === 'preparing' ? 'Step 1 of 2 · Preparing a compact image…' : stage === 'saving' ? 'Step 2 of 2 · Saving image and journal record…' : 'Photo saved.'}</Text>}
    {guard.dialog}
    <GrowPress accessibilityRole="button" accessibilityLabel="Save progress photo" disabled={!uri || busy || picking || !draft.ready || !!draft.saved} onPress={save} style={[ds.button, { backgroundColor: t.accent, marginTop: 18, opacity: !uri || busy ? 0.5 : 1 }]}>{busy && <ActivityIndicator color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy ? stage === 'preparing' ? 'Preparing image…' : 'Saving photo…' : error ? 'Retry photo upload' : 'Save progress photo'}</Text></GrowPress>
  </View></SafeAreaView></Modal>;
}
