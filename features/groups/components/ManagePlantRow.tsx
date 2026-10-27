import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlantImage } from '@/ui/PlantImage';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import { gardenThemes } from '@/design-system/tokens/garden';
import type { Plant } from '@/firestoreModels';

const t = gardenThemes.grove;
export default function ManagePlantRow({ plant, onOpen, onMove, onRemove, selected, onToggle, subtitle, disabled = false }: { plant: Plant & { id: string }; onOpen?(): void; onMove?(): void; onRemove?(): void; selected?: boolean; onToggle?(): void; subtitle?: string; disabled?: boolean }) {
  const uri = getRenderablePlantImageUri(plant.imageUri);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  return <View style={{ borderRadius: 16, borderWidth: 1, borderColor: selected ? t.accent : '#40523a', backgroundColor: selected ? t.elevated : t.surface, overflow: 'hidden', marginBottom: 10 }}>
    <Pressable accessibilityRole={onToggle ? 'checkbox' : 'button'} accessibilityLabel={onToggle ? `Select ${plant.name}` : `Open ${plant.name}`} accessibilityState={onToggle ? { checked: !!selected, disabled } : { disabled }} disabled={disabled} onPress={onToggle || onOpen} style={({ pressed }) => ({ minHeight: 82, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed || disabled ? 0.65 : 1 })}>
      {uri && !failed ? <PlantImage source={{ uri }} onError={() => setFailed(true)} style={{ width: 46, height: 56, borderRadius: 11 }} /> : <View style={{ width: 46, height: 56, borderRadius: 11, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="sprout" size={25} color={t.accent} /></View>}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ color: t.text, fontSize: 16, lineHeight: 22, fontWeight: '600' }}>{plant.name}</Text><Text style={{ color: t.muted, fontSize: 12, lineHeight: 18, textTransform: subtitle ? 'none' : 'capitalize' }}>{subtitle || (plant.status === 'active' ? plant.growthStage : plant.status)}</Text></View>
      <MaterialCommunityIcons name={onToggle ? selected ? 'checkbox-marked' : 'checkbox-blank-outline' : 'chevron-right'} size={23} color={onToggle && selected ? t.accent : t.muted} />
    </Pressable>
    {(onMove || onRemove) && <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#40523a' }}>{[{ label: 'Move', icon: 'swap-horizontal' as const, action: onMove }, { label: 'Remove', icon: 'minus-circle-outline' as const, action: onRemove }].filter(item => item.action).map((item, index) => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label} ${plant.name}${item.label === 'Remove' ? ' from garden' : ' to another garden'}`} onPress={item.action} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderLeftWidth: index ? 1 : 0, borderLeftColor: '#40523a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: pressed ? t.elevated : 'transparent' })}><MaterialCommunityIcons name={item.icon} size={19} color={t.accent} /><Text style={{ color: t.text, fontSize: 13, fontWeight: '500' }}>{item.label}</Text></Pressable>)}</View>}
  </View>;
}
