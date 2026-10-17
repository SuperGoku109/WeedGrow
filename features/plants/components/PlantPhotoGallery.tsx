import { PlantImage as Image } from '@/ui/PlantImage';
import React from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GrowPress, GrowReveal, useReducedMotion } from '@/ui/GrowMotion';
import { uploadProgressPic } from '@/lib/progressPics/uploadProgressPic';
import type { ProgressPic } from '../hooks/useProgressGallery';
import { detailStyles as ds, EmptyCard, SectionTitle } from './PlantDetailPanels';
import type { PlantTheme } from './plantDetailTheme';
export function PlantPhotoGallery({ pics, loading, error, theme: t, onAdd }: { pics: ProgressPic[]; loading: boolean; error: string; theme: PlantTheme; onAdd: () => void }) {
  const [selected, setSelected] = React.useState<ProgressPic | null>(null);
  const reduced = useReducedMotion();
  return <GrowReveal><SectionTitle theme={t} title="Progress photos" caption={pics.length + (pics.length === 1 ? ' photo' : ' photos')} />
    {error || loading ? <EmptyCard theme={t} title={error ? 'Photos unavailable' : 'Loading photos…'} text={error || 'Gathering your progress photos.'} /> : !pics.length ? <View style={[ds.card, { backgroundColor: t.surface, borderColor: t.border, alignItems: 'center', paddingVertical: 32 }]}><MaterialCommunityIcons name="image-outline" size={36} color={t.muted} /><Text style={{ color: t.text, fontSize: 18, fontWeight: '600', marginTop: 16 }}>No progress photos yet</Text><Text style={[ds.body, { color: t.muted, textAlign: 'center', marginTop: 8, marginBottom: 20 }]}>Add photos over time to see how your plant changes.</Text><GrowPress accessibilityRole="button" onPress={onAdd} style={[ds.button, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name="camera-plus-outline" size={20} color={t.accent} /><Text style={{ color: t.accent, fontSize: 14, fontWeight: '600' }}>Add first photo</Text></GrowPress></View> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{pics.map(pic => <View key={pic.id} style={{ width: '47.8%', flexGrow: 1 }}><GrowPress accessibilityRole="button" accessibilityLabel={`View photo ${pic.caption || pic.timestamp?.toDate?.().toLocaleDateString() || ''}`} onPress={() => setSelected(pic)}><Image source={{ uri: pic.imageUrl }} style={{ width: '100%', aspectRatio: 0.9, borderRadius: 19, backgroundColor: t.elevated }} /><Text style={{ color: t.muted, fontSize: 14, marginTop: 8 }}>{pic.timestamp?.toDate?.().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) || 'Just added'}</Text>{pic.caption && <Text numberOfLines={2} style={{ color: t.text, fontSize: 14, marginTop: 4 }}>{pic.caption}</Text>}</GrowPress></View>)}</View>}
    <Modal visible={!!selected} onRequestClose={() => setSelected(null)} animationType={reduced ? 'none' : 'fade'}><SafeAreaView style={{ flex: 1, backgroundColor: t.background, padding: 18 }}><GrowPress accessibilityRole="button" accessibilityLabel="Close photo" onPress={() => setSelected(null)} style={{ alignSelf: 'flex-end', padding: 12 }}><MaterialCommunityIcons name="close" size={24} color={t.text} /></GrowPress>{selected && <><Image fullSize source={{ uri: selected.imageUrl }} resizeMode="contain" style={{ flex: 1 }} /><Text style={{ color: t.text, paddingVertical: 18 }}>{selected.caption}</Text></>}</SafeAreaView></Modal>
  </GrowReveal>;
}
export function PhotoComposer({ plantId, theme: t, onClose, onSaved }: { plantId: string; theme: PlantTheme; onClose: () => void; onSaved: () => void }) {
  const [uri, setUri] = React.useState('');
  const [caption, setCaption] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [picking, setPicking] = React.useState(false);
  const lock = React.useRef(false);
  const [error, setError] = React.useState('');
  const reduced = useReducedMotion();
  const choose = async () => {
    if (picking) return;
    setPicking(true); setError('');
    try {
      if (Platform.OS !== 'web') { const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); if (!permission.granted) { setError('Allow photo access to choose a progress picture.'); return; } }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled && result.assets[0]) setUri(result.assets[0].uri);
    } catch { setError('Could not open the photo library. Please try again.'); }
    finally { setPicking(false); }
  };
  const save = async () => {
    if (!uri || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await uploadProgressPic(plantId, uri, caption.trim()); onSaved(); }
    catch { setError('Photo upload failed. Your selection is still here; please try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Modal transparent visible animationType={reduced ? 'none' : 'slide'} onRequestClose={() => { if (!busy) onClose(); }}><SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(8,17,12,0.75)', justifyContent: 'flex-end', alignItems: 'center' }}><View style={{ width: '100%', maxWidth: 620, maxHeight: '95%', backgroundColor: t.background, borderRadius: 27, padding: 20 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}><Text style={[ds.title, { color: t.text }]}>Add progress photo</Text><GrowPress accessibilityRole="button" accessibilityLabel="Close photo form" disabled={busy || picking} onPress={onClose} style={{ padding: 10 }}><MaterialCommunityIcons name="close" color={t.text} size={22} /></GrowPress></View>
    <ScrollView keyboardShouldPersistTaps="handled">
      {uri ? <Image source={{ uri }} resizeMode="contain" style={{ width: '100%', height: 220, backgroundColor: t.surface, borderRadius: 20 }} /> : <EmptyCard theme={t} title="Choose a progress photo" text="Choose a photo, add a caption, then save it to this plant’s gallery." />}
      <GrowPress accessibilityRole="button" disabled={busy || picking} onPress={choose} style={[ds.button, { backgroundColor: t.elevated, marginTop: 14 }]}><MaterialCommunityIcons name="image-plus" size={20} color={t.accent} /><Text style={{ color: t.accent }}>{picking ? 'Opening library…' : uri ? 'Choose a different photo' : 'Choose photo'}</Text></GrowPress>
      <Text style={{ color: t.text, marginTop: 20, marginBottom: 10, fontSize: 14 }}>Caption (optional)</Text><TextInput accessibilityLabel="Photo caption" value={caption} onChangeText={setCaption} editable={!busy} multiline maxLength={1000} placeholder="New leaves, a little stretch, the first flower…" placeholderTextColor={t.muted} style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 15, padding: 15, minHeight: 75, color: t.text, textAlignVertical: 'top' }} />
      {!!error && <Text accessibilityRole="alert" style={{ color: t.danger, marginTop: 12 }}>{error}</Text>}
    </ScrollView>
    <GrowPress accessibilityRole="button" accessibilityLabel="Save progress photo" disabled={!uri || busy || picking} onPress={save} style={[ds.button, { backgroundColor: t.accent, marginTop: 18, opacity: !uri || busy ? 0.5 : 1 }]}>{busy && <ActivityIndicator color={t.onAccent} />}<Text style={{ color: t.onAccent, fontWeight: '700' }}>{busy ? 'Uploading photo…' : 'Save progress photo'}</Text></GrowPress>
  </View></SafeAreaView></Modal>;
}
