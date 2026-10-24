import { useEditDraft, DraftRecovery } from '@/ui/useEditDraft';
import React from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FontAwesomeIcon from 'react-native-vector-icons/FontAwesome';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/ui/ThemedText';
import { AnimatedMakikoInput } from '@/components/ui/AnimatedMakikoInput';
import { AnimatedMakikoDropdownInput } from '@/components/ui/AnimatedMakikoDropdownInput';
import { getAvailableStrains } from '@/features/addPlant/api/basicInfoApi';
import { potSizeOptions, sunlightOptions } from '@/features/addPlant/api/environmentApi';
import { deletePlantAndSubcollections, updatePlant } from '../api/plantService';
import logger from '@/lib/logger';
import type { Plant } from '@/firestoreModels';
import { LinearGradient } from 'expo-linear-gradient';
import { ColorTokens, Typography } from '@/design-system/tokens';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDiscardGuard } from '@/ui/useDiscardGuard';
import PlantLocationEditor from '@/features/location/PlantLocationEditor';
import { validCoordinates } from '@/features/location/locationService';

type EditPlantFormState = {
  name: string;
  height: string;
  strain: string;
  potSize: string;
  growthStage: string;
  environment: string;
  sunlightExposure: string;
  locationNickname: string;
  locationLabel: string;
  locationMode: 'custom' | 'space';
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

type EditPlantModalProps = {
  visible: boolean;
  plant: Plant;
  plantId: string;
  onClose: () => void;
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

const ENVIRONMENT_META: Record<string, { icon: string; color: string; label: string }> = {
  outdoor: { icon: 'weather-sunny', color: ColorTokens.environment.outdoor, label: 'Outdoor' },
  greenhouse: { icon: 'greenhouse', color: ColorTokens.environment.greenhouse, label: 'Greenhouse' },
  indoor: { icon: 'home-city', color: ColorTokens.environment.indoor, label: 'Indoor' },
};

const emptyFormState: EditPlantFormState = {
  name: '',
  height: '',
  strain: '',
  potSize: '',
  growthStage: '',
  environment: '',
  sunlightExposure: '',
  locationNickname: '',
  locationLabel: '',
  locationMode: 'custom',
  lat: '',
  lng: '',
};

function getEnvironmentMeta(environment: string) {
  return (
    ENVIRONMENT_META[environment] ?? {
      icon: 'help-circle-outline',
      color: ColorTokens.text.secondary,
      label: environment ? environment.charAt(0).toUpperCase() + environment.slice(1) : 'Unknown',
    }
  );
}

export default function EditPlantModal({ visible, plant, plantId, onClose }: EditPlantModalProps) {
  const router = useRouter();
  const theme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  const [form, setForm] = React.useState<EditPlantFormState>(emptyFormState);
  const initial = React.useRef('');
  const hydratedForId = React.useRef<string | null>(null);
  const dirty = visible && !!initial.current && JSON.stringify(form) !== initial.current;
  const draft = useEditDraft(`plant.${plantId}.legacy`, form, plant as unknown as Record<string, unknown>, dirty, visible && hydratedForId.current === plantId);
  const guard = useDiscardGuard(dirty, () => draft.clear());
  const [errors, setErrors] = React.useState<EditPlantFormErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [locating, setLocating] = React.useState(false);


  const stageLabel = React.useMemo(
    () => STAGE_OPTIONS.find((option) => option.value === form.growthStage)?.label ?? 'Not set',
    [form.growthStage],
  );
  const environmentMeta = React.useMemo(() => getEnvironmentMeta(form.environment), [form.environment]);
  const strainOptions = React.useMemo(
    () => getAvailableStrains().map((option) => ({ label: option, value: option })),
    [],
  );


  React.useEffect(() => {
    if (!visible) {
      hydratedForId.current = null;
      return;
    }
    if (hydratedForId.current === plantId) return;
    const next = {
      name: plant.name ?? '',
      height: typeof plant.height === 'number' ? String(plant.height) : '',
      strain: plant.strain ?? '',
      potSize: plant.potSize ?? '',
      growthStage: plant.growthStage ?? '',
      environment: plant.environment ?? '',
      sunlightExposure: plant.sunlightExposure ?? '',
      locationNickname: plant.locationNickname ?? '',
    locationLabel: plant.locationLabel ?? '',
    locationMode: plant.locationMode || 'custom',
      lat: typeof plant.location?.lat === 'number' ? String(plant.location.lat) : '',
      lng: typeof plant.location?.lng === 'number' ? String(plant.location.lng) : '',
    };
    initial.current = JSON.stringify(next); setForm(next);
    setErrors({});
    hydratedForId.current = plantId;
  }, [visible, plant, plantId]);

  const setField = React.useCallback(<K extends keyof EditPlantFormState>(key: K, value: EditPlantFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
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
  }, []);

  const validate = React.useCallback(() => {
    const nextErrors: EditPlantFormErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required.';

    if (form.height.trim()) {
      const nextHeight = Number(form.height);
      if (Number.isNaN(nextHeight)) {
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

    setErrors(nextErrors);
    return nextErrors;
  }, [form]);

  const buildUpdates = React.useCallback((current: Plant) => {
    const updates: Partial<Plant> = {};
  if (form.locationMode !== (current.locationMode || 'custom')) updates.locationMode = form.locationMode;

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
    if (nextEnvironment && nextEnvironment !== current.environment) updates.environment = nextEnvironment as any;

    const nextSunlight = form.sunlightExposure.trim() || null;
    if ((current.sunlightExposure ?? null) !== nextSunlight) {
      updates.sunlightExposure = nextSunlight as any;
    }

    if ((current.locationLabel || '') !== form.locationLabel.trim()) updates.locationLabel = form.locationLabel.trim();
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
  }, [form]);

  const handleSave = React.useCallback(async () => {
    if (saving) return;
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) return;

    const updates = buildUpdates(plant);
    if (Object.keys(updates).length === 0) {
      guard.finish(onClose);
      return;
    }

    try {
      setSaving(true);
      if (!draft.ready || draft.saved) throw new Error('Choose whether to recover the saved draft first.');
      await updatePlant(plantId, updates, draft.baseline.current);
      await draft.clear().catch(() => {});
      guard.finish(onClose);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save changes.';
      Alert.alert('Save failed', message);
      logger.error('Error saving plant edits', error);
    } finally {
      setSaving(false);
    }
  }, [plant, plantId, saving, validate, buildUpdates, onClose, guard, draft]);

  const handleDelete = React.useCallback(() => {
    if (deleting) return;
    Alert.alert('Delete Plant?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            await deletePlantAndSubcollections(plantId);
            guard.finish(onClose);
            router.replace('/(tabs)?tabIndex=1');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete plant.';
            Alert.alert('Delete failed', message);
            logger.error('Error deleting plant', error);
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }, [plantId, deleting, router, onClose, guard]);

  if (!visible) return null;

  const saveDisabled = saving || deleting || locating;
  const cancelDisabled = saving || deleting || locating;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => { if (!cancelDisabled) guard.requestClose(() => { void draft.clear().catch(() => {}); onClose(); }); }}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={[ThemeColorsBgStart, ThemeColorsBgEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.card, theme === 'dark' ? styles.cardDark : styles.cardLight]}
        >
          <LinearGradient
            colors={['rgba(16,185,129,0.22)', 'rgba(59,130,246,0.16)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.accent}
          />

          <View style={styles.headerRow}>
            <View style={styles.titleWrap}>
              <ThemedText type="subtitle" style={styles.title} accessibilityRole="header">
                Edit Plant
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Refine details, setup, and location.
              </ThemedText>
            </View>
            <Pressable
              onPress={() => guard.requestClose(() => { void draft.clear().catch(() => {}); onClose(); })}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Close edit plant"
            >
              <Feather name="x" size={22} color={ColorTokens.text.secondary} />
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.metaPill, styles.metaPillStage]}>
              <MaterialCommunityIcons name="sprout" size={14} color="#a7f3d0" />
              <ThemedText style={[styles.metaText, styles.metaTextStage]}>{stageLabel}</ThemedText>
            </View>
            <View style={styles.metaPill}>
              <MaterialCommunityIcons name={environmentMeta.icon} size={14} color={environmentMeta.color} />
              <ThemedText style={[styles.metaText, { color: environmentMeta.color }]}>{environmentMeta.label}</ThemedText>
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <DraftRecovery draft={draft} apply={setForm} />
            <View style={[styles.sectionCard, theme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight]}>
              <View style={styles.sectionHead}>
                <ThemedText style={styles.sectionTitle}>Essentials</ThemedText>
                <ThemedText style={styles.sectionHint}>Core details used across your plant profile.</ThemedText>
              </View>

              <View style={styles.row}>
                <View style={styles.fieldWide}>
                  <AnimatedMakikoInput
                    label="Plant Name"
                    iconClass={FontAwesomeIcon}
                    iconName="leaf"
                    iconColor={ColorTokens.brand.primary}
                    value={form.name}
                    onChangeText={(val) => setField('name', val)}
                    inputStyle={styles.input}
                    style={styles.tightInput}
                  />
                  {errors.name ? <ThemedText style={styles.errorText}>{errors.name}</ThemedText> : null}
                </View>

                <View style={styles.fieldCompact}>
                  <AnimatedMakikoInput
                    label="Height (cm)"
                    iconClass={MaterialCommunityIcons}
                    iconName="ruler"
                    iconColor={ColorTokens.brand.primary}
                    value={form.height}
                    onChangeText={(val) => setField('height', val)}
                    keyboardType="decimal-pad"
                    inputStyle={styles.input}
                    style={styles.tightInput}
                  />
                  {errors.height ? <ThemedText style={styles.errorText}>{errors.height}</ThemedText> : null}
                </View>
              </View>

              <AnimatedMakikoDropdownInput
                label="Strain"
                iconName="dna"
                iconClass={MaterialCommunityIcons}
                iconColor={ColorTokens.brand.primary}
                value={form.strain}
                options={strainOptions}
                onSelect={(val) => setField('strain', val)}
                placeholder="Select strain"
                style={styles.dropdownField}
              />
            </View>

            <View style={[styles.sectionCard, theme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight]}>
              <View style={styles.sectionHead}>
                <ThemedText style={styles.sectionTitle}>Setup</ThemedText>
                <ThemedText style={styles.sectionHint}>Keep growth and environment options consistent.</ThemedText>
              </View>

              <AnimatedMakikoDropdownInput
                label="Growth Stage"
                iconName="sprout"
                iconClass={MaterialCommunityIcons}
                iconColor={ColorTokens.brand.primary}
                value={form.growthStage}
                options={STAGE_OPTIONS}
                onSelect={(val) => setField('growthStage', val)}
                placeholder="Select stage"
                style={styles.dropdownField}
              />
              <AnimatedMakikoDropdownInput
                label="Environment"
                iconName="weather-partly-cloudy"
                iconClass={MaterialCommunityIcons}
                iconColor={ColorTokens.brand.primary}
                value={form.environment}
                options={ENVIRONMENT_OPTIONS}
                onSelect={(val) => setField('environment', val)}
                placeholder="Select environment"
                style={styles.dropdownField}
              />
              <AnimatedMakikoDropdownInput
                label="Pot Size"
                iconName="flower-outline"
                iconClass={MaterialCommunityIcons}
                iconColor={ColorTokens.brand.primary}
                value={form.potSize}
                options={potSizeOptions.map((opt) => ({ label: opt, value: opt }))}
                onSelect={(val) => setField('potSize', val)}
                placeholder="Select pot size"
                style={styles.dropdownField}
              />
              <AnimatedMakikoDropdownInput
                label="Sunlight Exposure"
                iconName="white-balance-sunny"
                iconClass={MaterialCommunityIcons}
                iconColor={ColorTokens.brand.primary}
                value={form.sunlightExposure}
                options={sunlightOptions.map((opt) => ({ label: opt.label, value: opt.value }))}
                onSelect={(val) => setField('sunlightExposure', val)}
                placeholder="Select sunlight"
              />
            </View>

            <View style={[styles.sectionCard, theme === 'dark' ? styles.sectionCardDark : styles.sectionCardLight]}>
              <View style={styles.sectionHead}>
                <ThemedText style={styles.sectionTitle}>Location</ThemedText>
                <ThemedText style={styles.sectionHint}>Set nickname and pin location directly on the map.</ThemedText>
              </View>

          <AnimatedMakikoInput label="Location nickname (optional)" iconClass={MaterialCommunityIcons} iconName="map-marker-outline" iconColor={ColorTokens.brand.primary} value={form.locationNickname} onChangeText={value => setField('locationNickname', value)} />
          <PlantLocationEditor groupId={plant.groupId} mode={form.locationMode} onModeChange={value => setField('locationMode', value)} location={form.lat.trim() && form.lng.trim() && validCoordinates({ lat: Number(form.lat), lng: Number(form.lng) }) ? { lat: Number(form.lat), lng: Number(form.lng) } : null} label={form.locationLabel} disabled={saving || deleting} onBusyChange={setLocating} onChange={(coords, name) => { setForm(previous => ({ ...previous, lat: coords ? String(coords.lat) : '', lng: coords ? String(coords.lng) : '', locationLabel: name })); setErrors(previous => ({ ...previous, lat: undefined, lng: undefined, location: undefined })); }} />
              {errors.location ? <ThemedText style={styles.errorText}>{errors.location}</ThemedText> : null}
            </View>

            <View style={styles.buttonStack}>
              <LinearGradient
                colors={[ColorTokens.brand.primary, ColorTokens.brand.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveGradient}
              >
                <Pressable
                  onPress={handleSave}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.saveBtn,
                    pressed && !saveDisabled && styles.btnPressed,
                    saveDisabled && styles.btnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save plant changes"
                  disabled={saveDisabled}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                  ) : (
                    <MaterialCommunityIcons name="content-save-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                  )}
                  <ThemedText style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</ThemedText>
                </Pressable>
              </LinearGradient>

              <View style={styles.secondaryButtonRow}>
                <Pressable
                  onPress={() => guard.requestClose(() => { void draft.clear().catch(() => {}); onClose(); })}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    styles.cancelBtn,
                    theme === 'dark' ? styles.cancelBtnDark : styles.cancelBtnLight,
                    pressed && styles.btnPressed,
                    cancelDisabled && styles.btnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing plant"
                  disabled={cancelDisabled}
                >
                  <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                </Pressable>

                <LinearGradient
                  colors={['#ef4444', '#b91c1c']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.deleteGradient}
                >
                  <Pressable
                    onPress={handleDelete}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.deleteBtn,
                      pressed && !deleting && styles.btnPressed,
                      deleting && styles.btnDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Delete plant"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                    ) : (
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                    )}
                    <ThemedText style={styles.deleteText}>{deleting ? 'Deleting...' : 'Delete Plant'}</ThemedText>
                  </Pressable>
                </LinearGradient>
              </View>
            </View>
          </ScrollView>
      {guard.dialog}
        </LinearGradient>
      </View>
    </Modal>
  );
}

const ThemeColorsBgStart = 'rgba(20, 24, 31, 1)';
const ThemeColorsBgEnd = 'rgba(20, 24, 31, 1)';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '94%',
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  cardDark: {
    backgroundColor: ColorTokens.background.card,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0,0,0,0.08)',
  },
  accent: {
    position: 'absolute',
    top: -48,
    right: -72,
    width: 300,
    height: 220,
    transform: [{ rotate: '18deg' }],
    borderRadius: 140,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    ...Typography.styles.h3,
    color: ColorTokens.text.primary,
    marginBottom: 2,
  },
  subtitle: {
    ...Typography.styles.bodySmall,
    color: ColorTokens.text.secondary,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(59,130,246,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.22)',
  },
  metaPillStage: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  metaText: {
    ...Typography.styles.label,
    color: '#dbeafe',
  },
  metaTextStage: {
    color: '#d1fae5',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 10,
    gap: 14,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  sectionCardDark: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionCardLight: {
    backgroundColor: 'rgba(17,24,39,0.03)',
    borderColor: 'rgba(17,24,39,0.08)',
  },
  sectionHead: {
    marginBottom: 2,
  },
  sectionTitle: {
    ...Typography.styles.h4,
    color: ColorTokens.text.primary,
  },
  sectionHint: {
    ...Typography.styles.caption,
    color: ColorTokens.text.secondary,
    marginTop: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldWide: {
    flex: 1,
  },
  fieldCompact: {
    width: 132,
  },
  locationField: {
    flex: 1,
    minWidth: 130,
  },
  tightInput: {
    marginBottom: 0,
  },
  dropdownField: {
    marginBottom: 2,
  },
  input: {
    color: '#fff',
    fontSize: 16,
    paddingLeft: 45,
    height: 48,
    textAlignVertical: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },
  errorText: {
    color: ColorTokens.status.error,
    fontSize: 12,
    marginTop: 6,
  },
  locationActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  locationActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    backgroundColor: 'rgba(16,185,129,0.16)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  locationActionText: {
    ...Typography.styles.label,
    color: '#d1fae5',
  },
  clearLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.28)',
    backgroundColor: 'rgba(148,163,184,0.12)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearLocationText: {
    ...Typography.styles.label,
    color: '#cbd5e1',
  },
  mapWrap: {
    alignItems: 'center',
  },
  mapHint: {
    ...Typography.styles.caption,
    color: ColorTokens.text.secondary,
    marginTop: -2,
    marginBottom: 2,
  },
  buttonStack: {
    gap: 10,
    marginTop: 2,
  },
  secondaryButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveGradient: {
    borderRadius: 12,
  },
  deleteGradient: {
    flex: 1,
    borderRadius: 12,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveBtn: {
    backgroundColor: 'transparent',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
  },
  cancelBtnDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cancelBtnLight: {
    backgroundColor: 'rgba(17,24,39,0.06)',
    borderColor: 'rgba(17,24,39,0.12)',
  },
  cancelText: {
    color: ColorTokens.text.primary,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: 'transparent',
  },
  deleteText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  btnPressed: {
    opacity: 0.82,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
