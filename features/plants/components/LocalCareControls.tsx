import React from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { GrowPress } from '@/ui/GrowMotion';
import { useSession } from '@/services/session';
import { useLocalCareRevision } from '@/hooks/useLocalCareRevision';
import { loadLocalCareSettings, saveLocalCareSettings, type LocalCareSettings } from '@/services/localCareSettings';
import { defaultLocalCareSettings, localCarePreset, localCareSettingsError } from '@/lib/careAlgorithm/localCare';
import type { PlantTheme } from './plantDetailTheme';
import type { Plant } from '@/firestoreModels';

/** The ordinary care flow has no engineering inputs. Test overrides are opt-in. */
export default function LocalCareControls({ plantId, plant, theme: t, onEditSetup, compact = false }: { plantId: string; plant?: Plant; theme: PlantTheme; onEditSetup?(): void; compact?: boolean }) {
  const { user } = useSession(); const revision = useLocalCareRevision();
  const [testing, setTesting] = React.useState(false); const [manual, setManual] = React.useState(false); const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true;
    void loadLocalCareSettings(plantId).then(value => { if (active) setManual(value.profileMode === 'manual'); }).catch(() => {});
    return () => { active = false; };
  }, [plantId, user?.uid, revision]);
  const automatic = async () => {
    try { await saveLocalCareSettings(plantId, defaultLocalCareSettings(Date.now() / 1000)); setManual(false); setTesting(false); setError(''); }
    catch { setError('Care settings could not be reset. Retry.'); }
  };
  if (compact && !manual && !error) return null;
  return <View style={{ marginTop: compact ? 10 : 0, gap: 5 }}>
    {manual && <Text style={{ color: t.warm, fontSize: 13, lineHeight: 19 }}>Manual test overrides are active.</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {manual && <GrowPress accessibilityRole="button" accessibilityLabel="Use automatic care" onPress={() => { void automatic(); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Use automatic care</Text></GrowPress>}
      {!compact && !manual && plant?.plantedIn === 'pot' && !plant.potSize && onEditSetup && <GrowPress accessibilityRole="button" onPress={onEditSetup} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.accent }}>Add pot size in plant details</Text></GrowPress>}
      {!compact && <GrowPress accessibilityRole="button" accessibilityLabel="Advanced care testing" accessibilityState={{ expanded: testing }} onPress={() => setTesting(!testing)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: t.muted, fontSize: 12 }}>{testing ? 'Hide advanced testing' : 'Advanced testing'}</Text></GrowPress>}
    </View>
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
    {!compact && testing && <ManualCareControls plantId={plantId} theme={t} />}
  </View>;
}

const fields = [
  ['et0MmPerDay', 'Test ET0 rate (mm/day)'], ['rainMmPerDay', 'Test rain rate (mm/day)'],
  ['initialReserveL', 'Starting water reserve (L)'], ['extraWaterL', 'Extra simulated water now (L)'],
  ['capacityL', 'Water capacity (L)'], ['thresholdL', 'Watering threshold (L)'],
  ['effectiveLossM2', 'Demand area (m²)'], ['catchmentM2', 'Rain catchment area (m²)'], ['retainedFraction', 'Water retention (0–1)'],
] as const;
type Field = typeof fields[number][0];
const drafts = (value: LocalCareSettings) => Object.fromEntries(fields.map(([key]) => [key, String(value[key])])) as Record<Field, string>;
function ManualCareControls({ plantId, theme: t }: { plantId: string; theme: PlantTheme }) {
  const { user } = useSession(); const revision = useLocalCareRevision();
  const [settings, setSettings] = React.useState(() => defaultLocalCareSettings(Date.now() / 1000));
  const [values, setValues] = React.useState(() => drafts(settings));
  const [includeJournal, setIncludeJournal] = React.useState(true);
  const [hours, setHours] = React.useState('24'); const [resetStart, setResetStart] = React.useState(false);
  const [open, setOpen] = React.useState(false); const [advanced, setAdvanced] = React.useState(false);
  const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState('');
  React.useEffect(() => {
    let active = true; setError('');
    void loadLocalCareSettings(plantId).then(value => {
      if (!active) return;
      setSettings(value); setValues(drafts(value)); setIncludeJournal(value.includeJournal); setResetStart(false);
      setHours(String(Math.max(1, Math.round((Date.now() / 1000 - value.anchorUtc) / 3600))));
    }).catch(() => { if (active) setError('Test settings could not be loaded. Choose a preset to reset them.'); });
    return () => { active = false; };
  }, [plantId, user?.uid, revision]);
  const persist = async (value: LocalCareSettings, profileMode: 'automatic' | 'manual' = 'manual') => {
    if (busy) return;
    setBusy(true); setError('');
    try { const override = { ...value, profileMode }; await saveLocalCareSettings(plantId, override); setSettings(override); setValues(drafts(override)); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Test settings could not be saved.'); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    const parsed = { ...settings, enabled: true, includeJournal };
    for (const [key] of fields) {
      const raw = values[key].trim();
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) { setError('Enter a non-negative number in every field. Blank values are not zero.'); return; }
      parsed[key] = Number(raw);
    }
    if (resetStart || !settings.enabled) {
      const length = Number(hours);
      if (!hours.trim() || !Number.isFinite(length) || length < 1 || length > 336) { setError('Choose a test window from 1 to 336 hours.'); return; }
      parsed.anchorUtc = Date.now() / 1000 - length * 3600;
    }
    const message = localCareSettingsError(parsed); if (message) { setError(message); return; }
    await persist(parsed);
  };
  const button = (label: string, onPress: () => void) => <GrowPress key={label} accessibilityRole="button" accessibilityLabel={label} disabled={busy}
    onPress={onPress} style={[s.button, { borderColor: t.border, backgroundColor: t.elevated, opacity: busy ? .5 : 1 }]}><Text style={{ color: t.accent, fontWeight: '600' }}>{label}</Text></GrowPress>;
  return <View style={[s.panel, { backgroundColor: t.surface, borderColor: t.border }]}>
    <GrowPress accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel="Algorithm controls" onPress={() => setOpen(!open)} style={s.header}>
      <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>Algorithm controls · on device</Text>
      <Text style={{ color: t.accent }}>{open ? 'Hide' : 'Open'}</Text>
    </GrowPress>
    <Text style={[s.note, { color: t.muted }]}>Experimental. {settings.enabled && settings.weatherMode === 'open-meteo' ? 'Open-Meteo model weather drives this estimate.' : settings.enabled ? `Test ET0 ${settings.et0MmPerDay} mm/day · test rain ${settings.rainMmPerDay} mm/day.` : 'Choose Open-Meteo weather or a manual preset to start.'} No backend worker required.</Text>
    <View style={s.buttons}>{button('Use Open-Meteo weather', () => { setOpen(true); void persist({ ...settings, enabled: true, weatherMode: 'open-meteo', anchorUtc: !settings.enabled || Date.now() / 1000 - settings.anchorUtc > 14 * 86400 ? Date.now() / 1000 - 86400 : settings.anchorUtc }); })}{button('Dry test', () => { setOpen(true); void persist(localCarePreset('dry', Date.now() / 1000)); })}{button('Rain test', () => { setOpen(true); void persist(localCarePreset('rainy', Date.now() / 1000)); })}</View>
    {open && <View style={{ gap: 12 }}>
      <Text style={[s.note, { color: t.muted }]}>{settings.weatherMode === 'open-meteo' ? 'Hourly ET0 and liquid rain come from Open-Meteo model estimates. The unfinished hour uses conditional zero-to-full model amounts; it is not measured weather. Starting reserve and profile parameters remain editable test assumptions.' : 'These rates are held constant over the test window. They are assumptions, not measured weather history. Open-Meteo still supplies conditions and weather warnings. Profile defaults are illustrative, not calibrated hops values.'}</Text>
      <View style={s.grid}>{fields.filter((_, index) => (settings.weatherMode !== 'open-meteo' || index >= 2) && (advanced || index < 4)).map(([key, label]) => <View key={key} style={s.field}>
        <Text style={{ color: t.muted, fontSize: 12 }}>{label}</Text>
        <TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={values[key]} onChangeText={value => setValues(previous => ({ ...previous, [key]: value }))}
          style={[s.input, { color: t.text, borderColor: t.border, backgroundColor: t.elevated }]} />
      </View>)}</View>
      <View style={s.toggle}><Text style={{ color: t.text, flex: 1 }}>Include recorded watering</Text><Switch accessibilityLabel="Include recorded watering" value={includeJournal} onValueChange={setIncludeJournal} /></View>
      <Text style={[s.note, { color: t.muted }]}>Extra simulated water is not saved to your journal. Recorded watering edits and deletions are included when you recalculate.</Text>
      <View style={[s.field, { flexGrow: 0, flexBasis: "auto" }]}><Text style={{ color: t.muted, fontSize: 12 }}>Replay hours (changing this resets the start)</Text><TextInput accessibilityLabel="Replay hours" keyboardType="decimal-pad" value={hours}
        onChangeText={value => { setHours(value); setResetStart(true); }} style={[s.input, { color: t.text, borderColor: t.border }]} /></View>
      <Text style={[s.note, { color: t.muted }]}>Test start: {new Date(settings.anchorUtc * 1000).toLocaleString()}. Current plant setup is assumed throughout the test window.</Text>
      <View style={s.buttons}>{button(advanced ? 'Hide profile parameters' : 'Edit profile parameters', () => setAdvanced(!advanced))}{button('Apply and recalculate', () => { void apply(); })}
        {button('Reset test start', () => { void persist({ ...settings, anchorUtc: Date.now() / 1000 - 86400 }); })}
        {button('Clear test', () => { void persist(defaultLocalCareSettings(Date.now() / 1000), 'automatic'); })}</View>
    </View>}
    {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
  </View>;
}
const s = StyleSheet.create({ panel: { marginTop: 12, borderWidth: 1, borderRadius: 18, padding: 14, gap: 12 }, header: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, minHeight: 32 },
  note: { fontSize: 13, lineHeight: 19 }, buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { minHeight: 42, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, field: { flexGrow: 1, flexBasis: 145, gap: 5 }, input: { borderWidth: 1, borderRadius: 10, minHeight: 44, paddingHorizontal: 12, fontSize: 15 }, toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 } });
