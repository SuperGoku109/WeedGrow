import CloseButton from '@/ui/CloseButton';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { gardenThemes } from '@/design-system/tokens/garden';
import { useReducedMotion } from '@/ui/GrowMotion';
import type { GardenSelection, HomeGarden } from '../gardenSelection';

const t = gardenThemes.grove;
const icons = { outdoor: 'weather-sunny', indoor: 'home-outline', greenhouse: 'greenhouse' } as const;
export default function GardenDropdown({ gardens, selection, counts, total, countsReady, onSelect, onCreate, onActions, disabled }: {
  gardens: HomeGarden[]; selection: GardenSelection; counts: Record<string, number>; total: number;
  onSelect(value: GardenSelection): void; onCreate(): void; onActions?(): void; disabled?: boolean; countsReady: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState({ x: 18, y: 150, width: 340 });
  const trigger = React.useRef<View>(null);
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const garden = selection.kind === 'garden' ? gardens.find(item => item.id === selection.id) : null;
  const name = garden?.name || (gardens.length ? 'All plants' : 'Your garden');
  React.useEffect(() => setOpen(false), [width, height]);
  const choose = (value: GardenSelection) => { setOpen(false); onSelect(value); };
  return <>
    <View ref={trigger} collapsable={false} style={s.trigger}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Select garden, current: ${name}`} accessibilityState={{ expanded: open, disabled }} disabled={disabled}
        onPress={() => trigger.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => { setAnchor({ x, y: y + measuredHeight + 8, width: measuredWidth }); setOpen(true); })}
        style={({ pressed }) => [{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }, pressed && { opacity: 0.88 }]}>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text style={s.eyebrow}>{garden ? 'YOUR GARDEN' : gardens.length ? 'YOUR COLLECTION' : 'ROOM TO GROW'}</Text>
          <Text accessibilityRole="header" numberOfLines={2} style={s.title}>{name}</Text>
          <Text style={s.subtitle}>{disabled ? 'Opening your garden…' : garden ? `${garden.environment.charAt(0).toUpperCase() + garden.environment.slice(1)} · ${countsReady ? counts[garden.id] || 0 : '—'} active plants` : `${countsReady ? total : '—'} plants · ${gardens.length ? 'Across your gardens' : 'Make yourself at home'}`}</Text>
        </View>
        <View style={s.chevron}><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={24} color={t.heroText} /></View>
      </Pressable>
      {onActions && <Pressable accessibilityRole="button" accessibilityLabel={garden ? `Garden actions for ${name}` : 'Plant collection options'} disabled={disabled} onPress={onActions} style={s.actionButton}><MaterialCommunityIcons name="dots-horizontal" size={23} color={t.heroText} /></Pressable>}
    </View>
    <Modal visible={open} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close garden selector" onPress={() => setOpen(false)} style={[StyleSheet.absoluteFill, { backgroundColor: '#07150e80' }]} />
        <View accessibilityViewIsModal style={[s.menu, { left: Math.max(12, Math.min(anchor.x, width - anchor.width - 12)), top: Math.min(anchor.y, height * 0.3), width: Math.min(anchor.width, width - 24), maxHeight: height * 0.62 }]}>
          <View style={s.menuHeader}><Text style={s.menuTitle}>Your gardens</Text><CloseButton label="Close garden menu" onPress={() => setOpen(false)} color={t.text} /></View>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled">
            {gardens.map(item => {
              const selected = selection.kind === 'garden' && selection.id === item.id;
              return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Switch to ${item.name}`} accessibilityState={{ selected }} onPress={() => choose({ kind: 'garden', id: item.id })} style={({ pressed }) => [s.option, selected && s.selected, pressed && { opacity: 0.75 }]}>
                <View style={s.optionIcon}><MaterialCommunityIcons name={icons[item.environment]} size={22} color={t.accent} /></View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={s.optionName}>{item.name}</Text><Text style={s.optionMeta}>{item.environment.charAt(0).toUpperCase() + item.environment.slice(1)} · {countsReady ? counts[item.id] || 0 : '—'} active plants</Text></View>
                {selected && <MaterialCommunityIcons name="check" color={t.accent} size={21} />}
              </Pressable>;
            })}
            <Pressable accessibilityRole="button" accessibilityLabel="Show all plants" accessibilityState={{ selected: selection.kind === 'all' }} onPress={() => choose({ kind: 'all' })} style={[s.option, { borderTopWidth: 1, borderTopColor: '#40523a', marginTop: 6 }, selection.kind === 'all' && s.selected]}>
              <View style={s.optionIcon}><MaterialCommunityIcons name="sprout-outline" size={22} color={t.muted} /></View><View style={{ flex: 1, gap: 4 }}><Text style={s.optionName}>All plants</Text><Text style={s.optionMeta}>Including plants without a garden</Text></View>{selection.kind === 'all' && <MaterialCommunityIcons name="check" color={t.accent} size={21} />}
            </Pressable>
          </ScrollView>
          <Pressable accessibilityRole="button" onPress={() => { setOpen(false); onCreate(); }} style={s.create}><MaterialCommunityIcons name="plus" size={20} color={t.accent} /><Text style={{ color: t.accent, fontSize: 15, fontWeight: '600' }}>Create a garden</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

const s = StyleSheet.create({
  trigger: { backgroundColor: t.hero, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: '#596b45' },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '700', letterSpacing: -0.8, color: t.heroText },
  subtitle: { fontSize: 13, lineHeight: 19, color: '#526344' },
  chevron: { width: 44, height: 44, backgroundColor: '#dce6c4', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  actionButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menu: { backgroundColor: t.surface, borderRadius: 22, borderWidth: 1, borderColor: '#52684b', padding: 8, boxShadow: '0px 12px 36px rgba(0,0,0,0.3)' },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12 },
  menuTitle: { color: t.muted, fontSize: 13, fontWeight: '600' },
  option: { minHeight: 72, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, borderRadius: 14 },
  selected: { backgroundColor: t.elevated },
  optionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: t.background, alignItems: 'center', justifyContent: 'center' },
  optionName: { fontSize: 16, fontWeight: '600', color: t.text },
  optionMeta: { fontSize: 12, color: t.muted, lineHeight: 18 },
  create: { minHeight: 52, marginTop: 6, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#40523a' },
});
