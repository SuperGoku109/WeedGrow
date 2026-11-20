import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/hooks/useAppTheme';
import { colorAlpha } from '@/design-system/tokens/garden';
import type { GardenCareGroup } from '@/features/home/gardenCare';
import PlantEditorSheet from '@/features/plants/components/PlantEditorSheet';
import type { CareTipTarget } from '@/lib/care/careTipHistory';
import ActionDialog from '@/ui/ActionDialog';

export function carePlantNames(plants: readonly { name: string }[]) {
  return plants.slice(0, 2).map(plant => plant.name).join(', ')
    + (plants.length > 2 ? ` +${plants.length - 2}` : '');
}

function isCareAlert(group: GardenCareGroup) {
  return !!group.tips && group.tips[0]?.tip.kind !== 'watering';
}

function isSoilCheck(group: GardenCareGroup) {
  return group.tips?.[0]?.tip.kind === 'watering' && /check.*soil|soil.*check/i.test(group.title);
}

function sharedForecast(group: GardenCareGroup) {
  if (group.tips?.[0]?.tip.kind !== 'weather') return '';
  const detail = group.plants[0].detail;
  const first = detail.split(/(?<=[.!?])\s+/)[0];
  return first !== detail && group.plants.every(plant => plant.detail.startsWith(first)) ? first : '';
}

export function CareTipRows({ groups, complete, featureFirst = false, confirmQuickAction = false }: {
  groups: GardenCareGroup[];
  complete(tips: readonly CareTipTarget[]): Promise<void>;
  featureFirst?: boolean;
  confirmQuickAction?: boolean;
}) {
  const t = useAppTheme();
  const router = useRouter();
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [confirmKey, setConfirmKey] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const inFlight = React.useRef(false);
  const opened = groups.find(group => group.key === openKey);
  const confirming = groups.find(group => group.key === confirmKey);
  const choosePlants = !!confirming && confirming.plants.length > 1 && !isCareAlert(confirming);
  const confirmTips = confirming?.tips?.filter(tip => !choosePlants || selected.includes(tip.plantId)) ?? [];
  const openedForecast = opened && featureFirst && opened === groups[0] ? sharedForecast(opened) : '';
  const selectedTips = opened?.tips?.filter(tip => selected.includes(tip.plantId)) ?? [];
  const open = (group: GardenCareGroup) => {
    setError('');
    setSelected([]);
    setOpenKey(group.key);
  };
  const close = () => { setOpenKey(null); setError(''); };
  const mark = async (group: GardenCareGroup, tips: readonly CareTipTarget[]) => {
    if (inFlight.current || !tips.length) return;
    inFlight.current = true;
    setBusy(group.key);
    setError('');
    try {
      await complete(tips);
      setOpenKey(null);
    } catch {
      setError('Could not save this care update. Try again.');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  return <View>
    {groups.map((group, index) => {
      const featured = featureFirst && index === 0 && isCareAlert(group);
      const routine = !group.tips?.length;
      const soil = isSoilCheck(group);
      const action = soil ? 'Mark checked' : isCareAlert(group) ? 'Mark handled' : 'Mark reviewed';
      const multi = group.plants.length > 1 && !isCareAlert(group);
      const forecast = featured ? sharedForecast(group) : '';
      return <View key={group.key} style={[s.row, { borderBottomColor: colorAlpha(t.border, .4) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Details for ${group.title}`}
          accessibilityHint={[forecast, carePlantNames(group.plants)].filter(Boolean).join(' ')} onPress={() => open(group)} style={s.detailTrigger}>
          {!featured && <MaterialCommunityIcons name={isCareAlert(group) ? 'alert-circle-outline' : soil ? 'water-outline' : 'clipboard-text-outline'} size={21} color={isCareAlert(group) ? t.warm : t.accent} />}
          <View style={s.copy}>
            <Text style={[featured ? s.featureTitle : s.title, { color: t.text }]}>{group.title}</Text>
            {!!forecast && <Text numberOfLines={2} style={{ color: t.text, fontSize: 14 }}>{forecast}</Text>}
            <Text style={[s.meta, { color: t.muted }]}>{carePlantNames(group.plants)}</Text>
          </View>
          {featured && <View style={[s.weatherMark, { backgroundColor: colorAlpha(t.warm, .15) }]}><MaterialCommunityIcons name={group.key.startsWith('weather:') && /wind|gust/i.test(group.title) ? 'weather-windy' : 'alert-outline'} size={28} color={t.warm} /></View>}
          <MaterialCommunityIcons name="chevron-right" size={16} color={t.muted} />
        </Pressable>
        {!routine && <Pressable accessibilityRole="button" accessibilityLabel={`${action}: ${group.title}`}
          accessibilityHint={confirmQuickAction ? 'Opens a confirmation' : multi ? 'Opens plant selection' : `Applies to ${group.plants.length} affected ${group.plants.length === 1 ? 'plant' : 'plants'}`}
          accessibilityState={{ disabled: !!busy, busy: busy === group.key }} disabled={!!busy}
          onPress={() => {
            if (confirmQuickAction) {
              setError('');
              setSelected([]);
              setConfirmKey(group.key);
            } else if (multi) open(group);
            else void mark(group, group.tips!);
          }}
          style={s.quick}>
          <MaterialCommunityIcons name={busy === group.key ? 'clock-outline' : 'check-circle-outline'} size={24} color={busy && busy !== group.key ? t.muted : t.accent} />
        </Pressable>}
      </View>;
    })}
    {!!error && !opened && <Text accessibilityRole="alert" style={{ color: t.danger, paddingVertical: 8 }}>{error}</Text>}
    {opened && <PlantEditorSheet title={opened.title} subtitle={carePlantNames(opened.plants)} theme={t} onClose={close} busy={!!busy}>
      {[...new Set(opened.plants.map(plant => plant.detail))].map(detail =>
        <View key={detail} style={{ gap: 4 }}>
          {opened.plants.some(plant => plant.detail !== detail) && <Text style={[s.meta, { color: t.muted }]}>{carePlantNames(opened.plants.filter(plant => plant.detail === detail))}</Text>}
          <Text style={{ color: t.text, fontSize: 15, lineHeight: 22 }}>{detail.slice(openedForecast.length).trim() || detail}</Text>
        </View>)}
      {!!opened.tips?.length && <View style={{ gap: 6 }}>
        {opened.plants.length > 1 && <CarePlantPicker plants={opened.plants} selected={selected} onChange={setSelected} disabled={!!busy} />}
        <Pressable accessibilityRole="button" disabled={!!busy || (opened.plants.length > 1 && !selectedTips.length)}
          onPress={() => void mark(opened, opened.plants.length === 1 ? opened.tips! : selectedTips)}
          style={[s.done, { backgroundColor: !busy && (opened.plants.length === 1 || selectedTips.length) ? t.accent : t.elevated }]}>
          <Text style={{ color: !busy && (opened.plants.length === 1 || selectedTips.length) ? t.onAccent : t.muted, fontWeight: '700' }}>
            {busy ? 'Saving…' : isSoilCheck(opened) ? 'Mark checked' : isCareAlert(opened) ? 'Mark handled' : 'Mark reviewed'}
          </Text>
        </Pressable>
      </View>}
      {!opened.tips?.length && <Pressable accessibilityRole="button" style={s.pick} onPress={() => { close(); router.push('/care'); }}>
        <Text style={{ color: t.accent, fontWeight: '600' }}>Open routine checklist</Text>
      </Pressable>}
      {!!error && <Text accessibilityRole="alert" style={{ color: t.danger }}>{error}</Text>}
      {opened.plants.length === 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Open care for ${opened.plants[0].name}: ${opened.title}`} style={s.pick}
        onPress={() => { close(); router.push({ pathname: '/plant/[id]', params: { id: opened.plants[0].id, returnToPlants: '1' } }); }}>
        <Text style={{ color: t.accent }}>Open {opened.plants[0].name}</Text>
      </Pressable>}
    </PlantEditorSheet>}
    {!!confirming?.tips?.length && <ActionDialog title="Mark as complete?" confirmLabel="Complete"
      description={choosePlants
        ? `Choose the plants to mark complete for “${confirming.title}”.`
        : `“${confirming.title}” will move to Completed for ${confirming.plants.length === 1 ? confirming.plants[0].name : `all ${confirming.plants.length} affected plants`}.`}
      confirmDisabled={!confirmTips.length} onClose={() => setConfirmKey(null)} onConfirm={() => complete(confirmTips)}>
      {saving => choosePlants ? <CarePlantPicker plants={confirming.plants} selected={selected} onChange={setSelected} disabled={saving} /> : null}
    </ActionDialog>}
  </View>;
}

function CarePlantPicker({ plants, selected, onChange, disabled }: {
  plants: GardenCareGroup['plants'];
  selected: string[];
  onChange(ids: string[]): void;
  disabled: boolean;
}) {
  const t = useAppTheme();
  const all = plants.every(plant => selected.includes(plant.id));
  return <View>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: all }} disabled={disabled}
      onPress={() => onChange(all ? [] : plants.map(plant => plant.id))} style={s.pick}>
      <MaterialCommunityIcons name={all ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={22} color={t.accent} />
      <Text style={{ color: t.text, fontWeight: '600' }}>Select all {plants.length} plants</Text>
    </Pressable>
    {plants.map(plant => {
      const checked = selected.includes(plant.id);
      return <Pressable key={plant.id} accessibilityRole="checkbox" accessibilityLabel={plant.name} accessibilityState={{ checked }} disabled={disabled}
        onPress={() => onChange(checked ? selected.filter(id => id !== plant.id) : [...selected, plant.id])} style={s.pick}>
        <MaterialCommunityIcons name={checked ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={21} color={t.accent} />
        <Text style={{ color: t.text, flex: 1 }}>{plant.name}</Text>
      </Pressable>;
    })}
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, borderBottomWidth: StyleSheet.hairlineWidth },
  detailTrigger: { flex: 1, minHeight: 59, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 9 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  quick: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  weatherMark: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontSize: 20, lineHeight: 24, fontWeight: '700', letterSpacing: -.4 },
  title: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
  meta: { fontSize: 13, lineHeight: 17 },
  pick: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 44 },
  done: { borderRadius: 22, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
