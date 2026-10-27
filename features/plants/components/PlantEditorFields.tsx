import React from 'react';
import { Animated, BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useReducedMotion } from '@/ui/GrowMotion';
import { plantThemes, type PlantTheme } from './plantDetailTheme';

const t = plantThemes.grove;
export const EditorTheme = React.createContext<PlantTheme>(t);

export function EditorField({ label, error, helper, suffix, inputRef, ...props }: TextInputProps & { label: string; error?: string; helper?: string; suffix?: string; inputRef?: React.Ref<TextInput> }) {
  const t = React.useContext(EditorTheme);
  const reduced = useReducedMotion();
  const focus = React.useRef(new Animated.Value(0)).current;
  const animate = (value: number) => {
    focus.stopAnimation();
    Animated.timing(focus, { toValue: value, duration: reduced ? 0 : 160, useNativeDriver: false }).start();
  };
  React.useEffect(() => () => focus.stopAnimation(), [focus]);
  return <View style={s.field}>
    <Text style={[s.label, { color: t.muted }]}>{label}</Text>
    <Animated.View style={[s.inputFrame, { backgroundColor: t.surface, borderColor: focus.interpolate({ inputRange: [0, 1], outputRange: [error ? t.danger : t.border, error ? t.danger : t.accent] }) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><TextInput {...props} ref={inputRef} accessibilityLabel={label} accessibilityHint={error || helper} aria-invalid={!!error} placeholderTextColor={t.muted} selectionColor={t.accent}
        onFocus={event => { animate(1); props.onFocus?.(event); }}
        onBlur={event => { animate(0); props.onBlur?.(event); }} style={[s.input, { color: t.text, flex: 1, width: undefined }, props.style]} />{suffix && <Text style={{ color: t.muted, paddingRight: 15, fontSize: 14 }}>{suffix}</Text>}</View>
    </Animated.View>
    {!!(error || helper) && <Text accessibilityRole={error ? "alert" : undefined} style={{ color: error ? t.danger : t.muted, fontSize: 13, lineHeight: 19 }}>{error || helper}</Text>}
  </View>;
}

export function EditorSelect({ label, value, options, onSelect, placeholder, disabled = false }: {
  label: string; value: string; options: { label: string; value: string }[]; onSelect: (value: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const t = React.useContext(EditorTheme);
  React.useEffect(() => {
    if (!open) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { setOpen(false); return true; });
    return () => listener.remove();
  }, [open]);
  React.useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const selected = options.find(option => option.value === value);
  const shown = options.filter(option => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <View style={s.field}>
    <Text style={[s.label, { color: t.muted }]}>{label}</Text>
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label || value || placeholder || 'Not set'}`} disabled={disabled} accessibilityState={{ expanded: open, disabled }} onPress={() => { Keyboard.dismiss(); setSearch(''); setOpen(!open); }}
        style={({ pressed }) => [s.select, { backgroundColor: t.surface, borderColor: open ? t.accent : t.border, borderBottomLeftRadius: open ? 0 : 12, borderBottomRightRadius: open ? 0 : 12, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}>
        <Text style={[s.value, { color: selected ? t.text : t.muted }]}>{selected?.label || value || placeholder || 'Not set'}</Text><Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
      </Pressable>
      {open && <View style={{ borderWidth: 1, borderTopWidth: 0, borderColor: t.accent, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: t.surface, overflow: 'hidden' }}>
        {options.length > 7 && <TextInput accessibilityLabel={`Search ${label.toLowerCase()}`} value={search} onChangeText={setSearch} placeholder="Search options…" placeholderTextColor={t.muted} style={{ margin: 8, padding: 12, minHeight: 48, borderRadius: 10, backgroundColor: t.background, color: t.text, fontSize: 16 }} />}
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}><View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ padding: 4 }}>{shown.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value }} onPress={() => { onSelect(option.value); setOpen(false); }} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, backgroundColor: value === option.value ? t.elevated : 'transparent', opacity: pressed ? 0.7 : 1 })}><Text style={[s.value, { color: value === option.value ? t.accent : t.text }]}>{option.label}</Text>{value === option.value && <Feather name="check" size={19} color={t.accent} />}</Pressable>)}</View></ScrollView>
        {!shown.length && <Text style={{ color: t.muted, padding: 14 }}>No matching options.</Text>}
      </View>}
    </View>
  </View>;
}

const s = StyleSheet.create({
  field: { gap: 5, minWidth: 0 },
  label: { color: t.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  inputFrame: { borderWidth: 1, borderRadius: 12, backgroundColor: t.background, overflow: 'hidden' },
  input: { color: t.text, fontSize: 16, minHeight: 48, paddingHorizontal: 12, paddingVertical: 11, width: '100%' },
  select: { borderWidth: 1, borderRadius: 12, backgroundColor: t.background, minHeight: 48, flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  value: { color: t.text, fontSize: 15, lineHeight: 22, flex: 1 },
});
