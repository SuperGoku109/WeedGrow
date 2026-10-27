import CloseButton from '@/ui/CloseButton';
import Feedback from '@/ui/Feedback';
import { gardenThemes } from '@/design-system/tokens/garden';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useSession } from '@/services/session';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { listSensorProfiles, saveSensorProfile, deleteSensorProfile, linkedProfilePlants, type SensorProfile } from '@/services/sensorProfiles';
import HomeBackground from '@/features/home/components/HomeBackground';
import { AppHeader } from '@/ui/AppHeader';
import { CollectionReveal as GrowReveal } from '@/features/groups/components/CollectionUI';
import ConfirmDeleteModal from '@/features/groups/components/ConfirmDeleteModal';

function GrowPress({ style, ...props }: React.ComponentProps<typeof Pressable>) {
  return <Pressable {...props} style={state => [typeof style === 'function' ? style(state) : style, { opacity: props.disabled ? 0.5 : state.pressed ? 0.76 : 1 }]} />;
}

const palette = gardenThemes.grove;

function ProfileHeroArt({ compact }: { compact: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.heroArt,
        compact && styles.heroArtCompact,
      ]}
    >
      <View style={styles.artHalo} />
      <View style={styles.artRing} />
      <MaterialCommunityIcons name="tune-variant" size={54} color="#365c37" />
      <View style={[styles.artDot, styles.artDotOne]} />
      <View style={[styles.artDot, styles.artDotTwo]} />
    </View>
  );
}

function ManageSensorProfilesContent({ emptyMessage }: { emptyMessage?: string } = {}) {
  const router = useRouter();
  const { user } = useSession();
  const { width, height } = useWindowDimensions();
  const compact = width < 460;
  const profileState = useAsyncResource<SensorProfile[]>(user?.uid || null, () => listSensorProfiles(), [], 'Could not load your profiles. Retry.');
  const profiles = profileState.data; const loading = profileState.loading; const loadError = profileState.error;
  const [deleteTarget, setDeleteTarget] = useState<SensorProfile | null>(null);
  const [editing, setEditing] = useState<SensorProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editEnv, setEditEnv] = useState<'indoor' | 'greenhouse'>('indoor');
  const [editManual, setEditManual] = useState(true);
  const [editTemp, setEditTemp] = useState('');
  const [editHumidity, setEditHumidity] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showLinked, setShowLinked] = useState(false);
  const [linkedProfileId, setLinkedProfileId] = useState<string | null>(null);
  const linkedState = useAsyncResource<{ name?: string }[]>(user && showLinked && linkedProfileId ? `${user.uid}:${linkedProfileId}` : null, () => linkedProfilePlants(linkedProfileId!), [], 'Could not load linked plants. Retry.');
  const linkedPlants = linkedState.data; const linkedError = linkedState.error; const linkedLoading = linkedState.loading;
  const manualCount = useMemo(() => profiles.filter(profile => profile.isManual !== false).length, [profiles]);

  const handleEdit = (profile: SensorProfile) => {
    setEditError('');
    setEditing(profile);
    setEditName(profile.name || '');
    setEditEnv(profile.environmentType || 'indoor');
    setEditManual(profile.isManual !== false);
    setEditTemp(profile.defaultTemp == null ? '' : String(profile.defaultTemp));
    setEditHumidity(profile.defaultHumidity == null ? '' : String(profile.defaultHumidity));
  };

  const handleSaveEdit = async () => {
    if (!editing || saving) return;
    if (!editName.trim()) { setEditError('Enter a profile name.'); return; }
    if (editManual && [editTemp, editHumidity].some(value => value.trim() && !Number.isFinite(Number(value)))) {
      setEditError('Enter valid numbers or leave the readings empty.');
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      await saveSensorProfile(editing.id, { name: editName, environmentType: editEnv, isManual: editManual, defaultTemp: editTemp.trim() ? Number(editTemp) : null, defaultHumidity: editHumidity.trim() ? Number(editHumidity) : null });
      setEditing(null);
      profileState.refresh();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'The profile could not be updated. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteSensorProfile(id);
      setDeleteTarget(null);
      profileState.refresh();
    } catch (error) {
      Alert.alert('Could not delete', error instanceof Error ? error.message : 'The profile could not be removed. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleShowLinkedPlants = (id: string) => { setLinkedProfileId(id); setShowLinked(true); };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <HomeBackground />
      <View style={styles.page}>
        <AppHeader />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
          <GrowReveal style={[styles.hero, compact && { minHeight: 0, marginBottom: 20 }]}>
            <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
              <Text style={styles.eyebrow}>YOUR SAVED SETUPS</Text>
              <Text accessibilityRole="header" style={[styles.heading, compact && styles.headingCompact]}>{compact ? 'Growing profiles' : <>Every space.<Text>{'\n'}</Text>Its own profile.</>}</Text>
              <Text style={styles.topInfo}>Saved indoor conditions for your plants.</Text>
              <GrowPress accessibilityRole="button" accessibilityLabel="Create a sensor profile" onPress={() => router.push('/add-sensor-profile')} style={styles.heroButton}>
                <MaterialCommunityIcons name="plus" size={18} color={palette.hero} />
                <Text style={styles.heroButtonText}>New profile</Text>
              </GrowPress>
            </View>
            {!compact && <ProfileHeroArt compact={compact} />}
            <View style={styles.heroStatus}>
              <View style={styles.statusItem}><Text style={styles.statusValue}>{loading && !profiles.length ? '—' : profiles.length}</Text><Text style={styles.statusLabel}>PROFILES</Text></View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}><Text style={styles.statusValue}>{loading && !profiles.length ? '—' : manualCount}</Text><Text style={styles.statusLabel}>MANUAL</Text></View>
              {!compact && <Text style={styles.statusMessage}>Made for your spaces</Text>}
            </View>
          </GrowReveal>

          <GrowReveal delay={80} style={styles.sectionHeading}>
            <View><Text style={styles.sectionEyebrow}>THE COLLECTION</Text><Text style={styles.sectionTitle}>Your profiles</Text></View>
            <View style={styles.countBadge}><Text style={styles.countText}>{loading && !profiles.length ? '—' : profiles.length}</Text></View>
          </GrowReveal>

          {loading && <Feedback tone="loading" message={profiles.length ? 'Refreshing profiles…' : 'Loading your profiles…'} />}

          {!!loadError && <Feedback tone="error" message={loadError} onRetry={profileState.refresh} />}
          {!loading && !loadError && profiles.length === 0 && (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}><MaterialCommunityIcons name="access-point" size={27} color={palette.accent} /></View>
              <Text style={styles.emptyTitle}>A clean slate</Text>
              <Text style={styles.emptyText}>{emptyMessage || 'Create a profile to keep the conditions for each grow space together.'}</Text>
              <GrowPress accessibilityRole="button" onPress={() => router.push('/add-sensor-profile')} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Create your first profile</Text><MaterialCommunityIcons name="arrow-right" size={17} color={palette.onAccent} />
              </GrowPress>
            </View>
          )}

          {profiles.map((profile, index) => {
            const environment = profile.environmentType || 'indoor';
            const isManual = profile.isManual !== false;
            return (
              <GrowReveal key={profile.id} delay={Math.min(index, 3) * 45} style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <View style={styles.profileIcon}><MaterialCommunityIcons name={environment === 'greenhouse' ? 'greenhouse' : 'home-outline'} size={23} color={palette.accent} /></View>
                  <View style={styles.profileIdentity}><Text style={styles.profileLabel}>SENSOR PROFILE</Text><Text style={styles.profileName}>{profile.name || 'Untitled profile'}</Text></View>
                  <View style={styles.environmentBadge}><Text style={styles.environmentText}>{environment}</Text></View>
                </View>

                <View style={styles.readingsRow}>
                  <View style={styles.reading}><MaterialCommunityIcons name="thermometer" size={17} color={palette.warm} /><View><Text style={styles.readingLabel}>TEMPERATURE</Text><Text style={styles.readingValue}>{isManual && profile.defaultTemp !== undefined ? `${profile.defaultTemp}°C` : 'Not set'}</Text></View></View>
                  <View style={styles.readingDivider} />
                  <View style={styles.reading}><MaterialCommunityIcons name="water-percent" size={17} color="#a8d5df" /><View><Text style={styles.readingLabel}>HUMIDITY</Text><Text style={styles.readingValue}>{isManual && profile.defaultHumidity !== undefined ? `${profile.defaultHumidity}%` : 'Not set'}</Text></View></View>
                </View>

                <View style={styles.sourceRow}><MaterialCommunityIcons name={isManual ? 'pencil-outline' : 'memory'} size={15} color={palette.muted} /><Text style={styles.sourceText}>{isManual ? 'Manual readings' : 'Hardware sensor'}</Text></View>

                <View style={styles.actionRow}>
                  <GrowPress accessibilityRole="button" accessibilityLabel={`Edit ${profile.name || 'profile'}`} onPress={() => handleEdit(profile)} style={styles.primaryAction}><MaterialCommunityIcons name="pencil-outline" size={17} color={palette.onAccent} /><Text style={styles.primaryActionText}>Edit profile</Text></GrowPress>
                  <GrowPress accessibilityRole="button" accessibilityLabel={`Plants linked to ${profile.name || 'profile'}`} onPress={() => handleShowLinkedPlants(profile.id)} style={styles.secondaryAction}><MaterialCommunityIcons name="sprout-outline" size={17} color={palette.accent} /><Text style={styles.secondaryActionText}>Linked plants</Text></GrowPress>
                  <GrowPress accessibilityRole="button" accessibilityLabel={`Delete ${profile.name || 'profile'}`} disabled={deletingId === profile.id} onPress={() => setDeleteTarget(profile)} style={styles.deleteAction}>
                    {deletingId === profile.id ? <ActivityIndicator size={16} color={palette.danger} /> : <MaterialCommunityIcons name="trash-can-outline" size={18} color={palette.danger} />}
                  </GrowPress>
                </View>
              </GrowReveal>
            );
          })}
        </ScrollView>
      </View>

      <Portal>
        <Dialog visible={!!editing} onDismiss={() => { if (!saving) setEditing(null); }} style={styles.dialog}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 24, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}><Text accessibilityRole="header" style={[styles.dialogTitle, { flex: 1 }]}>Edit sensor profile</Text><CloseButton label="Close sensor profile editor" disabled={saving} onPress={() => setEditing(null)} color={palette.text} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: height * 0.55 }}><Dialog.Content>
            <Text style={styles.dialogHint}>Tune the defaults for this grow space.</Text>
            <TextInput mode="outlined" label="Profile name" value={editName} onChangeText={setEditName} style={styles.input} outlineColor={palette.border} activeOutlineColor={palette.accent} textColor={palette.text} autoFocus left={<TextInput.Icon icon="label-outline" color={palette.muted} />} maxLength={32} />
            <Text style={styles.dialogLabel}>ENVIRONMENT</Text>
            <View style={styles.dialogRow}>
              <Button mode={editEnv === 'indoor' ? 'contained' : 'outlined'} onPress={() => setEditEnv('indoor')} icon="home-outline" style={styles.dialogChoice} buttonColor={editEnv === 'indoor' ? palette.accent : undefined} textColor={editEnv === 'indoor' ? palette.onAccent : palette.text}>Indoor</Button>
              <Button mode={editEnv === 'greenhouse' ? 'contained' : 'outlined'} onPress={() => setEditEnv('greenhouse')} icon="greenhouse" style={styles.dialogChoice} buttonColor={editEnv === 'greenhouse' ? palette.accent : undefined} textColor={editEnv === 'greenhouse' ? palette.onAccent : palette.text}>Greenhouse</Button>
            </View>
            <Text style={styles.dialogLabel}>DATA SOURCE</Text>
            <View style={styles.dialogRow}>
              <Button mode={editManual ? 'contained' : 'outlined'} onPress={() => setEditManual(true)} icon="pencil-outline" style={styles.dialogChoice} buttonColor={editManual ? palette.accent : undefined} textColor={editManual ? palette.onAccent : palette.text}>Manual</Button>
              <Button mode={!editManual ? 'contained' : 'outlined'} onPress={() => setEditManual(false)} icon="memory" style={styles.dialogChoice} buttonColor={!editManual ? palette.accent : undefined} textColor={!editManual ? palette.onAccent : palette.text}>Hardware</Button>
            </View>
            {editManual && <View style={styles.readingInputs}>
              <TextInput mode="outlined" label="Temperature (°C)" value={editTemp} onChangeText={setEditTemp} keyboardType="numeric" style={[styles.input, styles.halfInput]} outlineColor={palette.border} activeOutlineColor={palette.accent} textColor={palette.text} />
              <TextInput mode="outlined" label="Humidity (%)" value={editHumidity} onChangeText={setEditHumidity} keyboardType="numeric" style={[styles.input, styles.halfInput]} outlineColor={palette.border} activeOutlineColor={palette.accent} textColor={palette.text} />
            </View>}
            {!!editError && <Text accessibilityRole="alert" style={{ color: palette.danger, marginTop: 12 }}>{editError}</Text>}
          </Dialog.Content></ScrollView>
          <Dialog.Actions><Button disabled={saving} textColor={palette.muted} onPress={() => setEditing(null)}>Cancel</Button><Button loading={saving} buttonColor={palette.accent} textColor={palette.onAccent} mode="contained" onPress={handleSaveEdit} disabled={saving || !editName.trim()}>{saving ? 'Saving…' : 'Save changes'}</Button></Dialog.Actions>
        </Dialog>

        <Dialog visible={showLinked} onDismiss={() => setShowLinked(false)} style={styles.dialog}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 24, paddingRight: 16, paddingTop: 12, paddingBottom: 12 }}><Text accessibilityRole="header" style={[styles.dialogTitle, { flex: 1 }]}>Linked plants</Text><CloseButton label="Close linked plants" onPress={() => setShowLinked(false)} color={palette.text} /></View>
          <Dialog.Content>
            {linkedLoading ? <ActivityIndicator color={palette.accent} /> : linkedError ? <Text accessibilityRole="alert" style={styles.dialogHint}>{linkedError}</Text> : <ScrollView style={{ maxHeight: height * 0.5 }}>{linkedPlants.length === 0 ? <Text style={styles.dialogHint}>No plants use this profile yet.</Text> : linkedPlants.map((plant, index) => <View key={`${plant.name || 'plant'}-${index}`} style={styles.linkedPlant}><MaterialCommunityIcons name="sprout" size={18} color={palette.accent} /><Text style={styles.linkedPlantText}>{plant.name || 'Unnamed plant'}</Text></View>)}</ScrollView>}
          </Dialog.Content>

        </Dialog>
      </Portal>
      <ConfirmDeleteModal visible={!!deleteTarget} title="Delete this profile?" subtitle="This removes the saved profile, not your plants. This cannot be undone."
        loading={!!deletingId} onCancel={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget && !deletingId) void handleDelete(deleteTarget.id); }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  page: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  container: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 36 },
  hero: { minHeight: 246, borderRadius: 28, backgroundColor: palette.hero, overflow: 'hidden', marginBottom: 28 },
  heroCopy: { padding: 24, paddingBottom: 68, width: '72%', zIndex: 2 },
  heroCopyCompact: { width: '100%', padding: 20, paddingBottom: 66 },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 2, color: '#586547', marginBottom: 14 },
  heading: { color: palette.heroText, fontSize: 34, lineHeight: 38, fontWeight: '600', letterSpacing: -1.2 },
  headingCompact: { fontSize: 28, lineHeight: 33 },
  topInfo: { color: '#5a674b', fontSize: 13, lineHeight: 20, marginTop: 12, maxWidth: 280 },
  heroButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: palette.heroText, borderRadius: 14, paddingHorizontal: 16, minHeight: 48, marginTop: 18 },
  heroButtonText: { color: palette.hero, fontSize: 13, fontWeight: '700' },
  heroArt: { position: 'absolute', width: 120, height: 120, right: 22, top: 50, alignItems: 'center', justifyContent: 'center' },
  heroArtCompact: { right: -36, opacity: 0.25 },
  artHalo: { position: 'absolute', width: 106, height: 106, borderRadius: 53, backgroundColor: '#dce7bd', borderWidth: 1, borderColor: '#bacb91' },
  artRing: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: 'rgba(88, 101, 71, 0.18)', borderStyle: 'dashed' },
  artDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#ce7655' },
  artDotOne: { top: 8, right: 15 },
  artDotTwo: { bottom: 9, left: 10, backgroundColor: '#91aa5e' },
  heroStatus: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, backgroundColor: '#dce5c4', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24 },
  statusItem: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  statusValue: { color: palette.heroText, fontSize: 15, fontWeight: '800' },
  statusLabel: { color: '#4b5b3b', fontSize: 13, letterSpacing: 0.8 },
  statusDivider: { width: 1, height: 17, backgroundColor: '#b9c7a0', marginHorizontal: 12 },
  statusMessage: { marginLeft: 'auto', color: '#5b684e', fontSize: 13, flexShrink: 1, paddingLeft: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingHorizontal: 2 },
  sectionEyebrow: { color: palette.muted, fontSize: 13, fontWeight: '600', letterSpacing: 2, marginBottom: 7 },
  sectionTitle: { color: palette.text, fontSize: 26, fontWeight: '600', letterSpacing: -0.7 },
  countBadge: { minWidth: 30, height: 30, paddingHorizontal: 8, borderRadius: 15, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' },
  countText: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  loadingCard: { minHeight: 118, borderRadius: 22, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: palette.muted, fontSize: 13 },
  emptyCard: { alignItems: 'center', borderRadius: 24, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.surface, padding: 28 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: palette.elevated, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  emptyTitle: { color: palette.text, fontSize: 18, fontWeight: '700', marginBottom: 7 },
  emptyText: { color: palette.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 340 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.accent, borderRadius: 24, paddingHorizontal: 15, paddingVertical: 11, marginTop: 18 },
  emptyButtonText: { color: palette.onAccent, fontSize: 13, fontWeight: '700' },
  profileCard: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 24, padding: 20, marginBottom: 16 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 12 },
  profileIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: palette.elevated, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  profileIdentity: { flex: 1, minWidth: 110, paddingRight: 10 },
  profileLabel: { color: palette.muted, fontSize: 13, letterSpacing: 1.5, marginBottom: 6 },
  profileName: { color: palette.text, fontSize: 23, lineHeight: 28, fontWeight: '600', letterSpacing: -0.5 },
  environmentBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: palette.elevated, paddingHorizontal: 10, paddingVertical: 8 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.accent },
  environmentText: { color: palette.muted, fontSize: 13, textTransform: 'capitalize' },
  readingsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: palette.background, borderRadius: 17, marginTop: 20, paddingVertical: 18, paddingHorizontal: 14 },
  reading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  readingDivider: { width: 1, height: 29, backgroundColor: '#34493a', marginHorizontal: 12 },
  readingLabel: { color: palette.muted, fontSize: 13, letterSpacing: 0 },
  readingValue: { color: palette.text, fontSize: 21, fontWeight: '500', marginTop: 7 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, paddingHorizontal: 2 },
  sourceText: { color: palette.muted, fontSize: 13 },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 18, paddingTop: 18, borderTopWidth: 1, borderTopColor: palette.border },
  primaryAction: { flex: 1, minWidth: 106, minHeight: 48, borderRadius: 14, backgroundColor: palette.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10 },
  primaryActionText: { color: palette.onAccent, fontSize: 13, fontWeight: '700' },
  secondaryAction: { flex: 1.2, minWidth: 116, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: palette.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10 },
  secondaryActionText: { color: palette.text, fontSize: 13, fontWeight: '600' },
  deleteAction: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dialog: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 26, width: '90%', maxWidth: 520, alignSelf: 'center', maxHeight: '85%' },
  dialogTitle: { color: palette.text, fontSize: 25, fontWeight: '600', letterSpacing: -0.6 },
  dialogHint: { color: palette.muted, fontSize: 13, lineHeight: 18, marginBottom: 13 },
  dialogLabel: { color: palette.muted, fontSize: 13, letterSpacing: 1.4, marginTop: 18, marginBottom: 10 },
  dialogRow: { flexDirection: 'row', gap: 9 },
  dialogChoice: { flex: 1, borderColor: palette.border },
  input: { backgroundColor: '#1b2b22', fontSize: 16 },
  readingInputs: { flexDirection: 'row', gap: 9, marginTop: 15 },
  halfInput: { flex: 1 },
  linkedPlant: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  linkedPlantText: { color: palette.text, fontSize: 13 },
});

export default function ManageSensorProfilesScreen(props: { emptyMessage?: string } = {}) { const { user } = useSession(); return <ManageSensorProfilesContent key={user?.uid || 'signed-out'} {...props} />; }
