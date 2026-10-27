import React from 'react';
import { BackHandler, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Icon, palette, type IconName } from './FlowUI';

type Option = { value: string; label: string; icon?: IconName; detail?: string };
export default function FlowDropdown({ value, onChange, options, label, placeholder, disabled = false }: {
  value: string; onChange(value: string): void; label: string; placeholder: string; disabled?: boolean;
  options: readonly Option[];
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  React.useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(false); return true; });
    return () => subscription.remove();
  }, [open]);
  React.useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const selected = options.find(option => option.value === value);
  const visible = options.filter(option => `${option.label} ${option.detail || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}${selected ? `, ${selected.label}` : ''}`} accessibilityState={{ expanded: open, disabled }} disabled={disabled}
      onPress={() => { Keyboard.dismiss(); setQuery(''); setOpen(previous => !previous); }}
      style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 12, borderBottomLeftRadius: open ? 0 : 12, borderBottomRightRadius: open ? 0 : 12, borderColor: open ? palette.accent : palette.border, backgroundColor: palette.input, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 })}>
      {!!selected?.icon && <Icon name={selected.icon} size={21} />}
      <Text style={{ flex: 1, color: selected ? palette.ink : palette.muted, fontSize: 16 }}>{selected?.label || placeholder}</Text><Icon name={open ? "chevron-up" : "chevron-down"} size={22} color={palette.muted} />
    </Pressable>
    {open && <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: palette.accent, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: palette.input, overflow: 'hidden' }}>
      {options.length > 7 && <TextInput accessibilityLabel={`Search ${label.toLowerCase()}`} placeholder="Search…" placeholderTextColor={palette.muted} value={query} onChangeText={setQuery} style={{ minHeight: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: palette.border, borderRadius: 8, margin: 8, color: palette.ink, fontSize: 16 }} />}
      <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 280 }}><View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ padding: 4, gap: 2 }}>{visible.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: option.value === value }}
        onPress={() => { onChange(option.value); setOpen(false); }}
        style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, backgroundColor: option.value === value ? palette.panel : 'transparent', opacity: pressed ? 0.7 : 1 })}>
        {!!option.icon && <Icon name={option.icon} size={22} />}<View style={{ flex: 1, gap: 3 }}><Text style={{ color: option.value === value ? palette.accent : palette.ink, fontSize: 16, fontWeight: option.value === value ? '600' : '400' }}>{option.label}</Text>{!!option.detail && <Text style={{ color: palette.muted, fontSize: 13, lineHeight: 19 }}>{option.detail}</Text>}</View><Icon name={option.value === value ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={option.value === value ? palette.accent : palette.muted} />
      </Pressable>)}</View></ScrollView>
      {!visible.length && <Text style={{ color: palette.muted, padding: 14 }}>No matching options.</Text>}
    </View>}
    {!open && !!selected?.detail && <Text style={{ marginTop: 8, color: palette.muted, fontSize: 13, lineHeight: 19 }}>{selected.detail}</Text>}
  </View>;
}
