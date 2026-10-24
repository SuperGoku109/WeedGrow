import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useReducedMotion } from '@/ui/GrowMotion';
import { useAddPlantForm } from './hooks/useAddPlantForm';
import { PlantSaveError, savePlantToFirestore } from './api/savePlant';
import { normalizePlantForm, validatePlantForm, type FormErrors } from './plantFlowModel';
import { DetailsStep, IdentityStep, LocationStep, ReviewStep, SetupStep } from './components/FlowSteps';
import { Icon, palette, PlantIllustration, Press, s, ValidationContext } from './components/FlowUI';
import AccountPanel from '@/features/account/AccountPanel';
import { useSession } from '@/services/session';

const steps = [
  { label: 'Your plant', title: 'Every plant has a story.', subtitle: 'Let’s start with a name and where yours is today.', note: 'A new beginning', caption: 'From the first little leaf to all the moments that follow.' },
  { label: 'Setup', title: 'Make room for growth.', subtitle: 'Tell us about its home. Add as much detail as you know.', note: 'A place to thrive', caption: 'One plant. Its own little corner of the world.' },
  { label: 'Location', title: 'Find its little corner.', subtitle: 'Name the spot, and add a location if you’d like local weather.', note: 'Rooted somewhere', caption: 'A sunny windowsill, a quiet patio, a place to call home.' },
  { label: 'Details', title: 'The little things matter.', subtitle: 'A photo, a routine, a few notes. Make this plant your own.', note: 'Make it personal', caption: 'Keep the details you know. Discover the rest along the way.' },
  { label: 'Review', title: 'Ready to put down roots?', subtitle: 'One last look. You can edit any section before adding your plant.', note: 'The story starts here', caption: 'A little care today. A growing collection of memories tomorrow.' },
];
const stepFields = [['name', 'growthStage', 'strainType', 'startedOn', 'ageDays'], ['groupId', 'environment', 'plantedIn', 'soilPh'], ['location'], ['lastWateredOn', 'lastFedOn']] as const;

export default function AddPlantFlow() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  const { form, setField, resetForm, step, setStep, plantId, ready, offer, resumeDraft, clearDraft, flushDraft, draftError, savedAt } = useAddPlantForm();
  const { user, loading: sessionLoading } = useSession();
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [inputBusy, setInputBusy] = useState(false);
  const [errorTarget, setErrorTarget] = useState<string>();
  const [errorRevision, setErrorRevision] = useState(0);
  const savingRef = useRef(false);
  const scroll = useRef<ScrollView>(null);
  const contentRoot = useRef<View>(null);
  const transition = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0.2)).current;
  const reduced = useReducedMotion();
  const current = steps[step];
  const busy = saving || inputBusy || sessionLoading;
  const validationContext = React.useMemo(() => ({ target: errorTarget, revision: errorRevision, root: contentRoot, reveal: (y: number) => scroll.current?.scrollTo({ y, animated: !reduced }) }), [errorTarget, errorRevision, reduced]);
  useEffect(() => { if (user && accountOpen) setAccountOpen(false); }, [user, accountOpen]);

  useEffect(() => {
    transition.setValue(reduced ? 1 : 0);
    const animation = Animated.parallel([
      Animated.timing(transition, { toValue: 1, duration: reduced ? 0 : 340, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(progress, { toValue: (step + 1) / steps.length, duration: reduced ? 0 : 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [step, success, progress, reduced, transition]);

  const go = useCallback((next: number) => {
    Keyboard.dismiss(); setErrors({}); setErrorTarget(undefined); setSaveError(''); setStep(next); scroll.current?.scrollTo({ y: 0, animated: false });
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => {});
  }, [setStep]);
  const leave = () => router.replace({ pathname: '/(tabs)', params: { tabIndex: '1' } });
  const back = useCallback(() => {
    if (savingRef.current || inputBusy) return;
    if (editing) { setEditing(false); go(4); }
    else if (step === 0) setExitOpen(true);
    else go(step - 1);
  }, [step, editing, go, inputBusy]);
  useFocusEffect(useCallback(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { if (success) return false; back(); return true; });
    return () => listener.remove();
  }, [back, success]));

  const next = () => {
    if (busy) return;
    const validation = validatePlantForm(form);
    const fields = stepFields[step as 0 | 1 | 2 | 3] || [];
    const first = fields.find(key => validation[key]);
    if (first) { setErrors(Object.fromEntries(fields.filter(key => validation[key]).map(key => [key, validation[key]]))); setErrorTarget(first); setErrorRevision(value => value + 1); return; }
    if (editing) { setEditing(false); go(4); } else go(step + 1);
  };
  const save = async () => {
    if (savingRef.current || inputBusy) return;
    const clean = normalizePlantForm(form);
    const validation = validatePlantForm(clean);
    if (Object.keys(validation).length) {
      const invalidStep = stepFields.findIndex(fields => fields.some(key => validation[key]));
      go(Math.max(0, invalidStep)); setErrors(validation); setErrorTarget(Object.keys(validation)[0]); setErrorRevision(value => value + 1); setEditing(true); return;
    }
    if (!user) { await flushDraft().catch(() => {}); setAccountOpen(true); return; }
    savingRef.current = true; setSaving(true); setSaveError('');
    try {
      await flushDraft().catch(() => {});
      // Plant metadata and prepared photo assets commit as one operation.
      await savePlantToFirestore(clean, plantId);
      setSuccess(true);
      await clearDraft().catch(() => setSaveError('Your plant is saved. Its local draft could not be cleared; retrying that draft will not create a duplicate.'));
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      if (error instanceof PlantSaveError && error.field) {
        const invalidStep = stepFields.findIndex(fields => (fields as readonly string[]).includes(error.field!));
        go(Math.max(0, invalidStep)); setErrors({ [error.field]: error.message }); setErrorTarget(error.field); setErrorRevision(value => value + 1); setEditing(true);
      }
      setSaveError(error instanceof Error ? error.message : 'Your plant couldn’t be saved. Check your connection and try again.');
    } finally { savingRef.current = false; setSaving(false); }
  };

  const content = success ? <ScrollView contentContainerStyle={{ flexGrow: 1 }}><Animated.View style={[styles.success, { opacity: transition, transform: [{ translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
    <View style={styles.successArt}><PlantIllustration stage={form.growthStage} /></View>
    <View style={styles.successBadge}><Icon name="check" color={palette.dark} /></View>
    <Text style={styles.eyebrow}>A NEW CHAPTER</Text>
    <Text accessibilityRole="header" style={[styles.title, { textAlign: 'center' }]}>{form.name.trim()} is in your garden.</Text>
    <Text style={[s.hint, { textAlign: 'center', maxWidth: 340 }]}>Your plant and its details are saved. Its story is ready to grow.</Text>
    <Text style={[s.hint, { textAlign: 'center' }]}>Next, open your plant to record an activity, follow its photo timeline or complete its care details.</Text>
    {!!saveError && <Text accessibilityRole="alert" style={s.error}>{saveError}</Text>}
    <Press label="View plant" onPress={() => router.replace({ pathname: '/plant/[id]', params: { id: plantId, welcome: '1' } })} style={s.button}><Text style={s.buttonText}>Open plant and next steps</Text><Icon name="arrow-right" color={palette.dark} size={19} /></Press>
    <Press label="Back to my plants" onPress={leave} style={{ padding: 16 }}><Text style={{ color: palette.accent }}>Back to my plants</Text></Press>
    <Press label="Add another plant" onPress={() => { void resetForm().then(() => { setSuccess(false); setEditing(false); go(0); }).catch(() => setSaveError('Could not clear the local draft. Please try again.')); }} style={{ padding: 12 }}><Text style={s.hint}>Add another plant</Text></Press>
  </Animated.View></ScrollView> : <>
    <View style={styles.header}>
      <View style={styles.headerInner}><View style={styles.brand}><Icon name="sprout" size={22} /><Text style={styles.brandText}>weedgrow<Text style={{ color: palette.muted }}> / new plant</Text></Text></View><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Press label="Garden account" disabled={busy} onPress={() => setAccountOpen(true)} style={{ padding: 10 }}><Icon name={user ? 'account-check-outline' : 'account-outline'} size={24} /></Press><Press label="Close add plant" disabled={busy} onPress={() => setExitOpen(true)} style={styles.close}><Icon name="close" size={21} color={palette.muted} /></Press></View></View>
    </View>
    <View style={[styles.body, !wide && { paddingHorizontal: 20, gap: 0 }]}>
      {wide && <ScrollView style={styles.sidebar} contentContainerStyle={{ paddingTop: 36, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        <View style={styles.artPanel}><Text style={styles.artEyebrow}>GROW SOMETHING GOOD</Text><PlantIllustration stage={form.growthStage} /><Text style={styles.artTitle}>{current.note}</Text><Text style={styles.artCaption}>{current.caption}</Text></View>
        <View style={{ gap: 7, marginTop: 30 }}>{steps.map((item, i) => <Press key={item.label} label={'Go to ' + item.label} disabled={i >= step || busy} selected={i === step} onPress={() => go(i)} style={[styles.railStep, i === step ? { backgroundColor: '#2a3d2a' } : {}]}><View style={[styles.stepNumber, i === step ? { backgroundColor: palette.accent, borderColor: palette.accent } : {}]}>{i < step ? <Icon name="check" size={16} /> : <Text style={{ color: i === step ? palette.dark : palette.muted, fontSize: 12 }}>{i + 1}</Text>}</View><Text style={{ color: i === step ? palette.ink : palette.muted, fontSize: 14 }}>{item.label}</Text></Press>)}</View>
        <Text style={[s.hint, { marginTop: 24 }]}>Start with what you know. You can always add more later.</Text>
      </ScrollView>}
      <View style={styles.main}>
        <View style={styles.progressHeader}><Text style={styles.eyebrow}>STEP {String(step + 1).padStart(2, '0')} / 05</Text><Text style={s.hint}>{current.label}</Text></View>
        <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          <View ref={contentRoot} collapsable={false}><ValidationContext.Provider value={validationContext}><Animated.View style={{ opacity: transition, transform: [{ translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <View style={styles.intro}><Text accessibilityRole="header" style={[styles.title, !wide && { fontSize: 30 }]}>{current.title}</Text><Text style={styles.subtitle}>{current.subtitle}</Text></View>
            <View style={[styles.formPanel, !wide && { padding: 0, borderWidth: 0, backgroundColor: 'transparent' }]} pointerEvents={saving ? 'none' : 'auto'}>
              {step === 0 && <IdentityStep form={form} setField={setField} errors={errors} />}
              {step === 1 && <SetupStep form={form} setField={setField} errors={errors} onSignIn={() => setAccountOpen(true)} />}
              {step === 2 && <LocationStep form={form} setField={setField} errors={errors} onBusyChange={setInputBusy} onSkip={() => { if (editing) { setEditing(false); go(4); } else go(3); }} />}
              {step === 3 && <DetailsStep form={form} setField={setField} errors={errors} onBusyChange={setInputBusy} />}
              {step === 4 && <><View style={{ marginBottom: 20, gap: 8 }}><Text style={s.label}>{user ? `Saving to ${user.email || 'your garden account'}` : 'Sign in when you’re ready to save'}</Text><Text style={s.hint}>{user ? 'This plant will belong to your account.' : 'You can review and edit everything first. Your draft is kept on this device.'}</Text></View><ReviewStep form={normalizePlantForm(form)} edit={target => { if (!savingRef.current) { setEditing(true); go(target); } }} /></>}
            </View>
          </Animated.View></ValidationContext.Provider></View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {!!saveError && <Text accessibilityRole="alert" style={s.error}>{saveError}</Text>}
          {!!draftError ? <Text accessibilityRole="alert" style={s.error}>{draftError}</Text> : !!savedAt && <Text accessibilityLiveRegion="polite" style={s.hint}>Draft saved on this device</Text>}
          {Object.keys(errors).length > 0 && <Text accessibilityLiveRegion="polite" style={s.error}>Check the highlighted fields to continue.</Text>}
          <View style={styles.footerActions}><Press label={step === 0 && !editing ? 'Cancel' : 'Back'} disabled={busy} onPress={back} style={[s.button, s.secondary, { paddingHorizontal: 17 }]}><Icon name="arrow-left" size={18} color={palette.muted} /><Text style={s.secondaryText}>{step === 0 && !editing ? 'Cancel' : 'Back'}</Text></Press><Press label={step === 4 ? user ? 'Add plant' : 'Sign in and save plant' : editing ? 'Return to review' : 'Continue'} disabled={busy} onPress={step === 4 ? save : next} style={s.button}>{saving ? <ActivityIndicator color={palette.dark} /> : null}<Text style={s.buttonText}>{saving ? 'Saving your plant…' : inputBusy ? 'Please wait…' : step === 4 ? user ? 'Add to my garden' : 'Sign in and save' : editing ? 'Return to review' : 'Continue'}</Text>{!saving && <Icon name={step === 4 ? 'plus' : 'arrow-right'} color={palette.dark} size={19} />}</Press></View>
        </View>
      </View>
    </View>
  </>;
  if (!ready && !success) return <SafeAreaView style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator accessibilityLabel="Restoring your draft" color={palette.accent} /></SafeAreaView>;
  return <SafeAreaView style={styles.screen} edges={['top']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView>
    <Modal visible={exitOpen} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setExitOpen(false)}><View style={styles.scrim}><View style={styles.dialog}><Icon name="sprout-outline" size={30} /><Text style={s.sectionTitle}>Leave this plant for now?</Text><Text style={s.hint}>Save a draft to finish later, or discard it and start fresh.</Text><Press label="Keep adding" onPress={() => setExitOpen(false)} style={s.button}><Text style={s.buttonText}>Keep adding</Text></Press><Press label="Save draft and leave" onPress={() => { void flushDraft().then(() => { setExitOpen(false); leave(); }).catch(() => setExitOpen(false)); }} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Save draft and leave</Text></Press><Press label="Discard and leave" onPress={() => { void resetForm().then(() => { setExitOpen(false); leave(); }).catch(() => setSaveError('Could not discard the draft. Please try again.')); }} style={{ padding: 12 }}><Text style={s.hint}>Discard draft</Text></Press></View></View></Modal>
    <Modal visible={!!offer} transparent animationType="fade" onRequestClose={resumeDraft}><View style={styles.scrim}><View style={styles.dialog}><Icon name="sprout" size={30} /><Text style={s.sectionTitle}>Continue your plant?</Text><Text style={s.hint}>{offer?.form.name || 'Your plant draft'} is saved on this device. Pick up where you left off.</Text><Press label="Resume plant draft" onPress={resumeDraft} style={s.button}><Text style={s.buttonText}>Resume draft</Text></Press><Press label="Discard saved draft" onPress={() => { void resetForm().catch(() => setSaveError('Could not discard the saved draft.')); }} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Start fresh</Text></Press></View></View></Modal>
    <Modal visible={accountOpen} transparent animationType="slide" onRequestClose={() => setAccountOpen(false)}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.scrim}><View style={[styles.dialog, { maxWidth: 520, maxHeight: '94%' }]}><Press label="Close garden account" onPress={() => setAccountOpen(false)} style={{ alignSelf: 'flex-end', padding: 10 }}><Icon name="close" /></Press><ScrollView keyboardShouldPersistTaps="handled"><AccountPanel /></ScrollView></View></KeyboardAvoidingView></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg }, header: { borderBottomWidth: 1, borderBottomColor: '#2e4032' }, headerInner: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 28, height: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, brand: { flexDirection: 'row', gap: 10, alignItems: 'center' }, brandText: { fontSize: 16, fontWeight: '600', color: palette.ink, letterSpacing: -0.4 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.border, borderRadius: 25 },
  body: { flex: 1, flexDirection: 'row', maxWidth: 1120, width: '100%', alignSelf: 'center', paddingHorizontal: 28, gap: 48 }, sidebar: { width: 266, flexGrow: 0, flexShrink: 0 }, artPanel: { borderRadius: 24, backgroundColor: palette.soft, alignItems: 'center', padding: 23, gap: 12 }, artEyebrow: { color: '#60704e', letterSpacing: 2, fontSize: 9, fontWeight: '600' }, artTitle: { color: palette.dark, fontSize: 24, textAlign: 'center', letterSpacing: -0.8, fontWeight: '500' }, artCaption: { color: '#60704e', textAlign: 'center', fontSize: 13, lineHeight: 21 }, railStep: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 10, borderRadius: 12 }, stepNumber: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0 }, progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 10 }, eyebrow: { color: palette.accent, fontSize: 10, fontWeight: '600', letterSpacing: 2 }, progressTrack: { height: 3, backgroundColor: '#304331', borderRadius: 3, overflow: 'hidden', marginBottom: 5 }, progressFill: { height: 3, backgroundColor: palette.accent }, intro: { paddingVertical: 25, gap: 10 }, title: { color: palette.ink, fontSize: 34, fontWeight: '500', letterSpacing: -1.3, lineHeight: 42 }, subtitle: { color: palette.muted, fontSize: 14, lineHeight: 22 }, formPanel: { backgroundColor: palette.panel, borderRadius: 22, borderWidth: 1, borderColor: '#344735', padding: 26 }, footer: { paddingTop: 15, gap: 12, borderTopWidth: 1, borderTopColor: '#304331', backgroundColor: palette.bg }, footerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  success: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 28, gap: 20 }, successArt: { backgroundColor: palette.soft, width: 210, height: 210, borderRadius: 105, alignItems: 'center', justifyContent: 'center' }, successBadge: { width: 42, height: 42, borderRadius: 21, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', marginTop: -42, marginLeft: 135, borderWidth: 4, borderColor: palette.bg }, scrim: { flex: 1, backgroundColor: '#07130dcc', alignItems: 'center', justifyContent: 'center', padding: 24 }, dialog: { width: '100%', maxWidth: 380, padding: 26, borderRadius: 24, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.border, gap: 20 },
});
