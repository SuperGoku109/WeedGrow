import React from 'react';
import { Animated, Easing, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GrowPress, useReducedMotion } from '@/ui/GrowMotion';
import { menuPosition, type MenuAnchor } from '@/ui/AnchoredActionMenu';
import { gardenThemes } from '@/design-system/tokens/garden';
import { DEFAULT_PLANT_LIST_OPTIONS, plantFilterValues, plantSortOptions, selectPlantList, type PlantListOptions, type PlantListStage } from '@/lib/plants/plantListOptions';
import { GROWTH_GUIDE_STAGES } from '@/features/plants/growthStagePresentation';
import type { Plant } from '@/firestoreModels';

const t = gardenThemes.grove;
export default function PlantFilterMenu({ anchor, options, status, plants, query, showEnvironment, onApply, onClose }: {
  anchor: MenuAnchor; options: PlantListOptions; status: string | null; plants: (Plant & { id: string })[]; query: string; showEnvironment: boolean;
  onApply(options: PlantListOptions, status: string): void; onClose(): void;
}) {
  const [draft, setDraft] = React.useState(options);
  const [draftStatus, setDraftStatus] = React.useState(status || 'past');
  const [measuredHeight, setMeasuredHeight] = React.useState(0);
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const dimensions = React.useRef({ width, fontScale });
  React.useEffect(() => { Keyboard.dismiss(); }, []);
  React.useEffect(() => {
    if (dimensions.current.width !== width || dimensions.current.fontScale !== fontScale) onClose();
  }, [width, fontScale, onClose]);
  React.useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [reduced, progress]);
  const position = menuPosition(anchor, width, height, (showEnvironment ? 438 : 366) * Math.max(1, fontScale), insets.top, insets.bottom, 340);
  const top = position.opensBelow ? position.top : Math.max(insets.top + 8, anchor.y - Math.min(measuredHeight || 320, position.maxHeight) - 10);
  const count = selectPlantList(plants, query, draftStatus, draft).length;
  const selectedStages = plantFilterValues<PlantListStage>(draft.stage);
  const selectedEnvironments = plantFilterValues<Plant['environment']>(draft.environment);
  const stages = [{ value: 'all', label: 'All' }, ...GROWTH_GUIDE_STAGES.map(item => ({ value: item.key, label: item.title }))];
  const environments = [{ value: 'all', label: 'All' }, { value: 'outdoor', label: 'Outdoor' }, { value: 'indoor', label: 'Indoor' }, { value: 'greenhouse', label: 'Greenhouse' }];
  const toggle = <T extends string,>(values: T[], value: T) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  const tiles = (label: string, choices: readonly { value: string; label: string }[], selected: string[], onSelect: (value: string) => void, multiple = true) => <View style={s.section}>
    <Text style={s.groupLabel}>{label}</Text>
    <View accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label} style={s.tiles}>{choices.map(item => {
      const checked = item.value === 'all' ? !selected.length : selected.includes(item.value);
      return <GrowPress key={item.value} containerStyle={multiple ? undefined : { flex: 1, minWidth: 0 }} accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={`${label}: ${item.label}`} aria-checked={checked} accessibilityState={{ checked }} onPress={() => onSelect(item.value)} style={[s.tile, checked && s.selectedTile]}><Text style={[s.tileText, checked && { color: t.accent, fontWeight: '600' }]}>{multiple ? item.label : item.label.replace(' added', '').replace('Name ', '')}</Text></GrowPress>;
    })}</View>
  </View>;

  return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss plant filters" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: '#07110c33' }]} />
      <Animated.View accessibilityViewIsModal accessibilityLabel="Filter and sort plants" onAccessibilityEscape={onClose} onLayout={event => setMeasuredHeight(event.nativeEvent.layout.height)} style={[s.menu, { left: position.left, top, width: position.width, maxHeight: position.maxHeight, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [position.opensBelow ? -5 : 5, 0] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }] }]}>
        <View style={s.header}><Text accessibilityRole="header" style={s.title}>Filter & sort</Text><GrowPress accessibilityRole="button" accessibilityLabel="Reset plant filters and sorting" onPress={() => { setDraft(DEFAULT_PLANT_LIST_OPTIONS); setDraftStatus('active'); }} style={s.reset}><Text style={{ color: t.accent, fontSize: 12 }}>Reset</Text></GrowPress></View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexShrink: 1, minHeight: 0 }}>
          {tiles('Sort by', plantSortOptions, [draft.sort], value => setDraft(previous => ({ ...previous, sort: value as PlantListOptions['sort'] })), false)}
          {tiles('Growth stages', stages, selectedStages, value => setDraft(previous => ({ ...previous, stage: value === 'all' ? 'all' : toggle(selectedStages, value as PlantListStage) })))}
          {showEnvironment && tiles('Environments', environments, selectedEnvironments, value => setDraft(previous => ({ ...previous, environment: value === 'all' ? 'all' : toggle(selectedEnvironments, value as Plant['environment']) })))}
          <GrowPress accessibilityRole="checkbox" accessibilityLabel="View past plants" accessibilityHint="Shows past plants instead of active plants." aria-checked={draftStatus !== 'active'} accessibilityState={{ checked: draftStatus !== 'active' }} onPress={() => setDraftStatus(previous => previous === 'active' ? 'past' : 'active')} style={s.statusRow}>
            <View style={[s.checkbox, draftStatus !== 'active' && { backgroundColor: t.accent, borderColor: t.accent }]}>{draftStatus !== 'active' && <MaterialCommunityIcons name="check" size={13} color={t.onAccent} />}</View><Text style={s.label}>View past plants</Text>
          </GrowPress>
        </ScrollView>
        <View style={s.footer}><GrowPress accessibilityRole="button" accessibilityLabel={`Show ${count} ${count === 1 ? 'plant' : 'plants'}`} onPress={() => { onApply(draft, draftStatus); onClose(); }} style={s.apply}><Text style={{ color: t.onAccent, fontSize: 13, fontWeight: '700' }}>Show {count} {count === 1 ? 'plant' : 'plants'}</Text></GrowPress></View>
      </Animated.View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  menu: { position: 'absolute', backgroundColor: t.surface, borderWidth: 1, borderColor: '#52674a', borderRadius: 18, overflow: 'hidden', boxShadow: '0px 10px 32px rgba(0,0,0,0.32)' },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 4, paddingVertical: 3, borderBottomWidth: 1, borderColor: t.elevated }, title: { flex: 1, color: t.text, fontSize: 14, fontWeight: '600' },
  reset: { minHeight: 32, paddingHorizontal: 10, justifyContent: 'center' },
  section: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 8, gap: 5, borderBottomWidth: 1, borderColor: t.elevated },
  groupLabel: { color: t.muted, fontSize: 12, fontWeight: '500', lineHeight: 17 }, tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tile: { minHeight: 36, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#40543d', alignItems: 'center', justifyContent: 'center' },
  selectedTile: { backgroundColor: t.elevated, borderColor: '#8baa68' }, tileText: { color: t.muted, fontSize: 12, lineHeight: 17 },
  label: { color: t.muted, fontSize: 13, lineHeight: 19 },
  statusRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderColor: t.elevated },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, borderColor: t.muted, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: 8 }, apply: { minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: t.accent, borderRadius: 11 },
});
