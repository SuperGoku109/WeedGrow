import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import { Feather } from '@expo/vector-icons';
import { EditorField, EditorSelect } from '../components/PlantEditorFields';

import { getAvailableStrains } from '@/features/addPlant/api/basicInfoApi';
import { potSizeOptions, sunlightOptions } from '@/features/addPlant/api/environmentApi';
import type { Plant } from '@/firestoreModels';
import { ColorTokens, Typography } from '@/design-system/tokens';
import { ThemedText } from '@/ui/ThemedText';
import logger from '@/lib/logger';
import { deletePlantAndSubcollections, updatePlant } from '../api/plantService';
import LoadingView from '../components/LoadingView';
import NotFoundView from '../components/NotFoundView';
import { plantThemes } from '../components/plantDetailTheme';
import { usePlant } from '../hooks/usePlant';
import ConfirmDeleteModal from '@/features/groups/components/ConfirmDeleteModal';

type EditPlantFormState = {
  name: string;
  height: string;
  strain: string;
  potSize: string;
  growthStage: string;
  environment: string;
  sunlightExposure: string;
  locationNickname: string;
  lat: string;
  lng: string;
};

type EditPlantFormErrors = {
  name?: string;
  height?: string;
  lat?: string;
  lng?: string;
  location?: string;
};

const STAGE_OPTIONS = [
  { label: 'Germination', value: 'germination' },
  { label: 'Seedling', value: 'seedling' },
  { label: 'Vegetative', value: 'vegetative' },
  { label: 'Flowering', value: 'flowering' },
  { label: 'Clone', value: 'clone' },
];

const ENVIRONMENT_OPTIONS = [
  { label: 'Outdoor', value: 'outdoor' },
  { label: 'Greenhouse', value: 'greenhouse' },
  { label: 'Indoor', value: 'indoor' },
];

const emptyFormState: EditPlantFormState = {
  name: '',
  height: '',
  strain: '',
  potSize: '',
  growthStage: '',
  environment: '',
  sunlightExposure: '',
  locationNickname: '',
  lat: '',
  lng: '',
};

function buildInitialFormState(plant: Plant): EditPlantFormState {
  return {
    name: plant.name ?? '',
    height: typeof plant.height === 'number' ? String(plant.height) : '',
    strain: plant.strain ?? '',
    potSize: plant.potSize ?? '',
    growthStage: plant.growthStage ?? '',
    environment: plant.environment ?? '',
    sunlightExposure: plant.sunlightExposure ?? '',
    locationNickname: plant.locationNickname ?? '',
    lat: typeof plant.location?.lat === 'number' ? String(plant.location.lat) : '',
    lng: typeof plant.location?.lng === 'number' ? String(plant.location.lng) : '',
  };
}

function buildUpdates(form: EditPlantFormState, current: Plant) {
  const updates: Partial<Plant> = {};

  const trimmedName = form.name.trim();
  if (trimmedName && trimmedName !== current.name) updates.name = trimmedName;

  const nextHeight = form.height.trim() ? Number(form.height) : null;
  const currentHeight = typeof current.height === 'number' ? current.height : null;
  if (currentHeight !== nextHeight) updates.height = nextHeight as any;

  const nextStrain = form.strain.trim();
  if ((current.strain ?? '') !== nextStrain) updates.strain = nextStrain;

  const nextPotSize = form.potSize.trim() || null;
  if ((current.potSize ?? null) !== nextPotSize) updates.potSize = nextPotSize as any;

  const nextStage = form.growthStage;
  if (nextStage && nextStage !== current.growthStage) updates.growthStage = nextStage as any;

  const nextEnvironment = form.environment;
  if (nextEnvironment && nextEnvironment !== current.environment) {
    updates.environment = nextEnvironment as any;
  }

  const nextSunlight = form.sunlightExposure.trim() || null;
  if ((current.sunlightExposure ?? null) !== nextSunlight) {
    updates.sunlightExposure = nextSunlight as any;
  }

  const nextLocationNickname = form.locationNickname.trim() || null;
  const currentLocationNickname = current.locationNickname?.trim() || null;
  if (currentLocationNickname !== nextLocationNickname) {
    updates.locationNickname = nextLocationNickname as any;
  }

  const latFilled = form.lat.trim().length > 0;
  const lngFilled = form.lng.trim().length > 0;
  let nextLocation: Plant['location'] | null = null;
  if (latFilled && lngFilled) {
    nextLocation = { lat: Number(form.lat), lng: Number(form.lng) };
  }

  const currentLocation = current.location ?? null;
  const locationChanged =
    (!currentLocation && nextLocation) ||
    (currentLocation && !nextLocation) ||
    (currentLocation &&
      nextLocation &&
      (currentLocation.lat !== nextLocation.lat || currentLocation.lng !== nextLocation.lng));

  if (locationChanged) updates.location = nextLocation as any;

  return updates;
}

function validateForm(form: EditPlantFormState) {
  const nextErrors: EditPlantFormErrors = {};
  if (!form.name.trim()) nextErrors.name = 'Name is required.';

  if (form.height.trim()) {
    const nextHeight = Number(form.height);
    if (!Number.isFinite(nextHeight)) {
      nextErrors.height = 'Height must be a number.';
    } else if (nextHeight < 0) {
      nextErrors.height = 'Height cannot be negative.';
    }
  }

  const latFilled = form.lat.trim().length > 0;
  const lngFilled = form.lng.trim().length > 0;
  if (latFilled || lngFilled) {
    if (!latFilled || !lngFilled) {
      nextErrors.location = 'Enter both latitude and longitude.';
    } else {
      const lat = Number(form.lat);
      const lng = Number(form.lng);

      if (Number.isNaN(lat)) nextErrors.lat = 'Latitude must be a number.';
      if (Number.isNaN(lng)) nextErrors.lng = 'Longitude must be a number.';

      if (!nextErrors.lat && (lat < -90 || lat > 90)) {
        nextErrors.lat = 'Latitude must be between -90 and 90.';
      }
      if (!nextErrors.lng && (lng < -180 || lng > 180)) {
        nextErrors.lng = 'Longitude must be between -180 and 180.';
      }
    }
  }

  return nextErrors;
}

function errorText(error?: string) {
  return error ? <ThemedText accessibilityRole="alert" style={styles.errorText}>{error}</ThemedText> : null;
}

export default function EditPlantScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { plant, loading } = usePlant(id);
  const t = plantThemes.grove;
  const [form, setForm] = React.useState<EditPlantFormState>(emptyFormState);
  const [errors, setErrors] = React.useState<EditPlantFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const saveLock = React.useRef(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteVisible, setDeleteVisible] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');
  const deleteLock = React.useRef(false);
  const [locating, setLocating] = React.useState(false);

  React.useEffect(() => {
    if (!plant) return;
    setForm(buildInitialFormState(plant));
    setErrors({});
  }, [plant]);

  const strainOptions = React.useMemo(
    () => getAvailableStrains().map((option) => ({ label: option, value: option })),
    [],
  );

  const setField = React.useCallback(
    <K extends keyof EditPlantFormState>(key: K, value: EditPlantFormState[K]) => {
      setForm((previous) => ({ ...previous, [key]: value }));
      setErrors((previous) => {
        const next = { ...previous };
        if (key === 'name') delete next.name;
        if (key === 'height') delete next.height;
        if (key === 'lat') {
          delete next.lat;
          delete next.location;
        }
        if (key === 'lng') {
          delete next.lng;
          delete next.location;
        }
        return next;
      });
    },
    [],
  );

  const handleClose = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (id) {
      router.replace({ pathname: '/plant/[id]', params: { id: String(id) } });
      return;
    }
    router.replace('/(tabs)?tabIndex=1');
  }, [id, router]);

  const handleUseCurrentLocation = React.useCallback(async () => {
    if (locating) return;
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is needed to auto-fill your position.');
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync();
      const coords = lastKnown?.coords
        ? lastKnown.coords
        : (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords;

      setForm((previous) => ({
        ...previous,
        lat: coords.latitude.toFixed(6),
        lng: coords.longitude.toFixed(6),
      }));
      setErrors((previous) => {
        const next = { ...previous };
        delete next.lat;
        delete next.lng;
        delete next.location;
        return next;
      });
    } catch (error) {
      logger.error('Error fetching current location for plant edit', error);
      Alert.alert('Location unavailable', 'Could not get your current location.');
    } finally {
      setLocating(false);
    }
  }, [locating]);

  const handleClearLocation = React.useCallback(() => {
    setField('lat', '');
    setField('lng', '');
  }, [setField]);

  const handleSave = React.useCallback(async () => {
    if (!plant || !id || saving || saveLock.current) return;
    setSaveError('');

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const updates = buildUpdates(form, plant);
    if (Object.keys(updates).length === 0) {
      handleClose();
      return;
    }

    try {
      saveLock.current = true;
      setSaving(true);
      await updatePlant(String(id), updates);
      handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save changes.';
      logger.error('Error saving plant edits', error);
      setSaveError(message);
    } finally {
      setSaving(false);
      saveLock.current = false;
    }
  }, [form, handleClose, id, plant, saving]);

  const handleDelete = React.useCallback(() => {
    if (saving || deleting) return;
    setDeleteError('');
    setDeleteVisible(true);
  }, [saving, deleting]);

  const confirmDelete = async () => {
    if (!id || deleteLock.current) return;
    deleteLock.current = true;
    setDeleting(true);
    setDeleteError('');
    try {
      await deletePlantAndSubcollections(String(id));
      setDeleteVisible(false);
      router.replace('/(tabs)?tabIndex=1');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete this plant.');
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  };

  if (loading) return <LoadingView />;
  if (!plant || !id) return <NotFoundView />;

  const disablePrimaryActions = saving || deleting;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: t.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Pressable
          accessibilityLabel="Close edit plant"
          accessibilityRole="button"
          onPress={handleClose}
          disabled={saving || deleting}
          style={[styles.headerButton, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <Feather name="arrow-left" size={20} color={t.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <ThemedText style={[styles.brand, { color: t.text }]}>weedgrow<ThemedText style={{ color: t.accent }}>.</ThemedText><ThemedText style={[styles.breadcrumb, { color: t.muted }]}> / plant space</ThemedText></ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { backgroundColor: t.hero }]}> 
          <View style={styles.heroCopy}>
            <ThemedText style={[styles.eyebrow, { color: t.heroText }]}>PLANT PASSPORT</ThemedText>
            <ThemedText style={[styles.heroTitle, { color: t.heroText }]}>Tend to the details.</ThemedText>
            <ThemedText style={[styles.heroBody, { color: t.heroText }]}>Keep {plant.name}&apos;s story accurate as it grows.</ThemedText>
          </View>
          <View style={[styles.heroMark, { backgroundColor: t.elevated }]}>
            <MaterialCommunityIcons name="sprout" size={38} color={t.accent} />
          </View>
        </View>

        <View
          style={[styles.section, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <View style={styles.sectionHeading}>
            <View style={[styles.sectionIcon, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name="leaf" size={18} color={t.accent} /></View>
            <View><ThemedText style={[styles.sectionEyebrow, { color: t.muted }]}>THE BASICS</ThemedText><ThemedText style={[styles.sectionTitle, { color: t.text }]}>Plant identity</ThemedText></View>
          </View>
          <View style={styles.row}>
            <View style={styles.fieldWide}>
              <EditorField
                label="Plant Name"
                value={form.name}
                onChangeText={(value) => setField('name', value)}
              />
              {errorText(errors.name)}
            </View>

            <View style={styles.fieldCompact}>
              <EditorField
                label="Height (cm)"
                value={form.height}
                onChangeText={(value) => setField('height', value)}
                keyboardType="decimal-pad"
              />
              {errorText(errors.height)}
            </View>
          </View>

          <EditorSelect
            label="Strain"
            onSelect={(value) => setField('strain', value)}
            options={strainOptions}
            placeholder="Select strain"
            value={form.strain}
          />
        </View>

        <View
          style={[styles.section, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <View style={styles.sectionHeading}>
            <View style={[styles.sectionIcon, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name="greenhouse" size={18} color={t.accent} /></View>
            <View><ThemedText style={[styles.sectionEyebrow, { color: t.muted }]}>GROWING CONDITIONS</ThemedText><ThemedText style={[styles.sectionTitle, { color: t.text }]}>The setup</ThemedText></View>
          </View>

          <EditorSelect
            label="Growth Stage"
            onSelect={(value) => setField('growthStage', value)}
            options={STAGE_OPTIONS}
            placeholder="Select stage"
            value={form.growthStage}
          />

          <EditorSelect
            label="Environment"
            onSelect={(value) => setField('environment', value)}
            options={ENVIRONMENT_OPTIONS}
            placeholder="Select environment"
            value={form.environment}
          />

          <EditorSelect
            label="Pot Size"
            onSelect={(value) => setField('potSize', value)}
            options={potSizeOptions.map((option) => ({ label: option, value: option }))}
            placeholder="Select pot size"
            value={form.potSize}
          />

          <EditorSelect
            label="Sunlight Exposure"
            onSelect={(value) => setField('sunlightExposure', value)}
            options={sunlightOptions.map((option) => ({ label: option.label, value: option.value }))}
            placeholder="Select sunlight"
            value={form.sunlightExposure}
          />
        </View>

        <View
          style={[styles.section, { backgroundColor: t.surface, borderColor: t.border }]}
        >
          <View style={styles.sectionHeading}>
            <View style={[styles.sectionIcon, { backgroundColor: t.elevated }]}><MaterialCommunityIcons name="map-marker-radius-outline" size={19} color={t.accent} /></View>
            <View><ThemedText style={[styles.sectionEyebrow, { color: t.muted }]}>WEATHER & PLACE</ThemedText><ThemedText style={[styles.sectionTitle, { color: t.text }]}>Where it grows</ThemedText></View>
          </View>
          <ThemedText style={[styles.sectionHint, { color: t.muted }]}>
            Use current location or edit coordinates manually.
          </ThemedText>

          <View style={styles.locationActionRow}>
            <Pressable
              accessibilityLabel="Use current location"
              accessibilityRole="button"
              disabled={locating}
              onPress={handleUseCurrentLocation}
              style={({ pressed }) => [
                styles.locationActionButton,
                pressed && styles.buttonPressed,
              ]}
            >
              {locating ? (
                <ActivityIndicator color="#d1fae5" size="small" style={styles.actionIcon} />
              ) : (
                <MaterialCommunityIcons
                  color={t.accent}
                  name="crosshairs-gps"
                  size={16}
                  style={styles.actionIcon}
                />
              )}
              <ThemedText style={styles.locationActionText}>
                {locating ? 'Locating...' : 'Use My Location'}
              </ThemedText>
            </Pressable>

            <Pressable
              accessibilityLabel="Clear location"
              accessibilityRole="button"
              onPress={handleClearLocation}
              style={({ pressed }) => [styles.clearLocationButton, pressed && styles.buttonPressed]}
            >
              <Feather color="#cbd5e1" name="x-circle" size={14} style={styles.actionIcon} />
              <ThemedText style={styles.clearLocationText}>Clear Coordinates</ThemedText>
            </Pressable>
          </View>

          <EditorField
            label="Location Name"
            value={form.locationNickname}
            onChangeText={(value) => setField('locationNickname', value)}
            autoCapitalize="words"
            autoCorrect={false}
          />

          <View style={styles.row}>
            <View style={styles.fieldWide}>
              <EditorField
                label="Latitude"
                value={form.lat}
                onChangeText={(value) => setField('lat', value)}
                keyboardType="numbers-and-punctuation"
              />
              {errorText(errors.lat)}
            </View>

            <View style={styles.fieldWide}>
              <EditorField
                label="Longitude"
                value={form.lng}
                onChangeText={(value) => setField('lng', value)}
                keyboardType="numbers-and-punctuation"
              />
              {errorText(errors.lng)}
            </View>
          </View>

          {errorText(errors.location)}
        </View>

        <View style={styles.buttonStack}>
          {!!saveError && <ThemedText accessibilityRole="alert" style={styles.errorText}>{saveError}</ThemedText>}
          <Pressable
            accessibilityLabel="Save plant changes"
            accessibilityRole="button"
            disabled={disablePrimaryActions}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: t.accent },
              disablePrimaryActions && styles.buttonDisabled,
              pressed && !disablePrimaryActions && styles.buttonPressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" size="small" style={styles.actionIcon} />
            ) : (
              <MaterialCommunityIcons
                color={t.onAccent}
                name="content-save-outline"
                size={18}
                style={styles.actionIcon}
              />
            )}
            <ThemedText style={[styles.primaryButtonText, { color: t.onAccent }]}>
              {saving ? 'Saving...' : 'Save Changes'}
            </ThemedText>
          </Pressable>

          <View style={styles.secondaryButtonRow}>
            <Pressable
              accessibilityLabel="Cancel editing plant"
              accessibilityRole="button"
              disabled={disablePrimaryActions}
              onPress={handleClose}
              style={({ pressed }) => [
                styles.secondaryButton,
                { backgroundColor: t.surface, borderColor: t.border },
                disablePrimaryActions && styles.buttonDisabled,
                pressed && !disablePrimaryActions && styles.buttonPressed,
              ]}
            >
              <ThemedText style={styles.secondaryButtonText}>Cancel</ThemedText>
            </Pressable>

            <Pressable
              accessibilityLabel="Delete plant"
              accessibilityRole="button"
              disabled={deleting}
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                deleting && styles.buttonDisabled,
                pressed && !deleting && styles.buttonPressed,
              ]}
            >
              {deleting ? (
                <ActivityIndicator color="#ffffff" size="small" style={styles.actionIcon} />
              ) : (
                <MaterialCommunityIcons
                  color="#ffffff"
                  name="trash-can-outline"
                  size={18}
                  style={styles.actionIcon}
                />
              )}
              <ThemedText style={styles.primaryButtonText}>
                {deleting ? 'Deleting...' : 'Delete Plant'}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      <ConfirmDeleteModal visible={deleteVisible} title="Delete this plant?" subtitle="This permanently deletes the plant and its history. This cannot be undone."
        loading={deleting} error={deleteError} onCancel={() => setDeleteVisible(false)} onConfirm={confirmDelete} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionIcon: {
    marginRight: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonStack: {
    gap: 10,
    marginTop: 2,
    paddingBottom: 38,
  },
  clearLocationButton: {
    alignItems: 'center',
    backgroundColor: '#2e4434',
    borderColor: '#40523a',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearLocationText: {
    ...Typography.styles.label,
    color: '#a9bba1',
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 760,
    paddingHorizontal: 18,
    paddingTop: 16,
    width: '100%',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#623a35',
    borderColor: '#8b5b52',
    borderRadius: 17,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  errorText: {
    color: ColorTokens.status.error,
    fontSize: 12,
    marginTop: 6,
  },
  fieldCompact: {
    width: 132,
  },
  fieldWide: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    alignSelf: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: 760,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerCopy: {
    flex: 1,
  },
  brand: {
    fontSize: 15,
    fontWeight: '700',
  },
  breadcrumb: {
    fontSize: 11,
    fontWeight: '400',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  hero: {
    alignItems: 'center',
    borderRadius: 26,
    flexDirection: 'row',
    minHeight: 170,
    overflow: 'hidden',
    padding: 22,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    opacity: 0.72,
  },
  heroCopy: {
    flex: 1,
    paddingRight: 16,
  },
  heroMark: {
    alignItems: 'center',
    borderRadius: 999,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  input: {
    color: '#edf0e3',
    fontSize: 16,
    height: 48,
    paddingBottom: 0,
    paddingLeft: 45,
    paddingTop: 0,
    textAlignVertical: 'center',
  },
  locationActionButton: {
    alignItems: 'center',
    backgroundColor: '#2e4434',
    borderColor: '#40523a',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  locationActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  locationActionText: {
    ...Typography.styles.label,
    color: '#c8e78b',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    alignItems: 'center',
    borderRadius: 17,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  screen: {
    flex: 1,
  },
  screenDark: {
    backgroundColor: '#10141c',
  },
  screenLight: {
    backgroundColor: '#f6f7fb',
  },
  section: {
    borderRadius: 23,
    borderWidth: 1,
    gap: 14,
    padding: 17,
  },
  sectionDark: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHint: {
    ...Typography.styles.bodySmall,
    color: ColorTokens.text.secondary,
    marginTop: -4,
  },
  sectionLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(15,23,42,0.08)',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 11,
    marginBottom: 12,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 13,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryButtonDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonLight: {
    backgroundColor: 'rgba(17,24,39,0.05)',
    borderColor: 'rgba(17,24,39,0.12)',
  },
  secondaryButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButtonText: {
    color: ColorTokens.text.primary,
    fontWeight: '700',
  },
  tightInput: {
    marginBottom: 0,
  },
});
