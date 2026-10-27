import React from 'react';
import { View } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { gardenThemes } from '@/design-system/tokens/garden';
import type { Group } from '@/firestoreModels';

const t = gardenThemes.grove;
const options = [
  { label: 'Outdoor', value: 'outdoor' as const },
  { label: 'Indoor', value: 'indoor' as const },
  { label: 'Greenhouse', value: 'greenhouse' as const },
];

export default function GardenEnvironmentDropdown({ value, onChange, disabled }: {
  value: Group['environment']; onChange(value: Group['environment']): void; disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <View style={{ zIndex: 1000 }}>
    <DropDownPicker<Group['environment']>
      open={open} setOpen={setOpen} value={value} items={options}
      setValue={action => { const next = typeof action === 'function' ? action(value) : action; if (next) onChange(next); }}
      disabled={disabled} listMode="SCROLLVIEW" dropDownDirection="BOTTOM"
      props={{ accessibilityLabel: `Growing environment, ${options.find(option => option.value === value)?.label}`, accessibilityRole: 'button', accessibilityState: { expanded: open, disabled } }}
      itemProps={{ accessible: true, accessibilityRole: 'button' }}
      style={{ minHeight: 52, borderRadius: 12, borderColor: open ? t.accent : t.border, backgroundColor: t.surface, paddingHorizontal: 14 }}
      textStyle={{ color: t.text, fontSize: 15 }}
      dropDownContainerStyle={{ backgroundColor: t.surface, borderColor: t.accent, borderRadius: 12 }}
      listItemContainerStyle={{ minHeight: 48 }}
      selectedItemContainerStyle={{ backgroundColor: t.elevated }}
      selectedItemLabelStyle={{ color: t.accent, fontWeight: '600' }}
      disabledStyle={{ opacity: 0.6 }}
      ArrowDownIconComponent={() => <MaterialCommunityIcons name="chevron-down" size={22} color={t.muted} />}
      ArrowUpIconComponent={() => <MaterialCommunityIcons name="chevron-up" size={22} color={t.accent} />}
      TickIconComponent={() => <MaterialCommunityIcons name="check" size={20} color={t.accent} />}
    />
  </View>;
}
