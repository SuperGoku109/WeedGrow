import React from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useReducedMotion } from '@/ui/GrowMotion';
import { plantThemes } from './plantDetailTheme';

const t = plantThemes.grove;

export function EditorField({ label, ...props }: TextInputProps & { label: string }) {
  const reduced = useReducedMotion();
  const focus = React.useRef(new Animated.Value(0)).current;
  const animate = (value: number) => {
    focus.stopAnimation();
    Animated.timing(focus, { toValue: value, duration: reduced ? 0 : 160, useNativeDriver: false }).start();
  };
  React.useEffect(() => () => focus.stopAnimation(), [focus]);
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <Animated.View style={[s.inputFrame, { borderColor: focus.interpolate({ inputRange: [0, 1], outputRange: [t.border, t.accent] }) }]}>
      <TextInput {...props} accessibilityLabel={label} placeholderTextColor={t.muted} selectionColor={t.accent}
        onFocus={event => { animate(1); props.onFocus?.(event); }}
        onBlur={event => { animate(0); props.onBlur?.(event); }} style={[s.input, props.style]} />
    </Animated.View>
  </View>;
}

export function EditorSelect({ label, value, options, onSelect, placeholder }: {
  label: string; value: string; options: { label: string; value: string }[]; onSelect: (value: string) => void; placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const reduced = useReducedMotion();
  const selected = options.find(option => option.value === value);
  const shown = options.filter(option => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <View style={s.field}>
    <Text style={s.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label || value || placeholder || 'Not set'}`}
      accessibilityState={{ expanded: open }} onPress={() => { setSearch(''); setOpen(true); }}
      style={({ pressed }) => [s.select, { borderColor: open ? t.accent : t.border, opacity: pressed ? 0.75 : 1 }]}>
      <Text style={[s.value, !value && { color: t.muted }]}>{selected?.label || value || placeholder || 'Not set'}</Text>
      <Feather name="chevron-down" size={18} color={t.muted} />
    </Pressable>
    <Modal visible={open} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={() => setOpen(false)}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable accessibilityLabel="Dismiss selection" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal style={s.sheet}>
          <View style={s.heading}>
            <View style={{ flex: 1 }}><Text style={s.eyebrow}>PLANT DETAILS</Text><Text accessibilityRole="header" style={s.title}>{label}</Text></View>
            <Pressable accessibilityLabel="Close selection" accessibilityRole="button" onPress={() => setOpen(false)} style={s.close}><Feather name="x" size={22} color={t.text} /></Pressable>
          </View>
          {options.length > 6 && <TextInput accessibilityLabel={`Search ${label.toLowerCase()}`} value={search} onChangeText={setSearch} placeholder="Search options…" placeholderTextColor={t.muted} style={s.search} />}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.options}>
            {shown.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value }}
              onPress={() => { onSelect(option.value); setOpen(false); }}
              style={({ pressed }) => [s.option, value === option.value && s.chosen, pressed && { opacity: 0.75 }]}>
              <Text style={s.value}>{option.label}</Text><Feather name={value === option.value ? 'check-circle' : 'circle'} size={20} color={value === option.value ? t.accent : t.border} />
            </Pressable>)}
            {!shown.length && <Text style={s.empty}>No matching options. Try another search.</Text>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  field: { gap: 9, minWidth: 0 },
  label: { color: t.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  inputFrame: { borderWidth: 1, borderRadius: 15, backgroundColor: t.background, overflow: 'hidden' },
  input: { color: t.text, fontSize: 16, minHeight: 54, paddingHorizontal: 15, paddingVertical: 14, width: '100%' },
  select: { borderWidth: 1, borderRadius: 15, backgroundColor: t.background, minHeight: 54, flexDirection: 'row', alignItems: 'center', padding: 15, gap: 12 },
  value: { color: t.text, fontSize: 15, lineHeight: 22, flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(6,15,10,0.76)', padding: 20, justifyContent: 'center', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 500, maxHeight: '80%', backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 26, overflow: 'hidden' },
  heading: { flexDirection: 'row', alignItems: 'center', padding: 22, gap: 12 },
  eyebrow: { color: t.accent, fontSize: 9, letterSpacing: 2, marginBottom: 8, fontWeight: '700' },
  title: { color: t.text, fontSize: 25, fontWeight: '600', letterSpacing: -0.6 },
  close: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  search: { marginHorizontal: 18, marginBottom: 8, borderRadius: 14, backgroundColor: t.background, color: t.text, padding: 14, fontSize: 15 },
  options: { padding: 14, paddingTop: 0, gap: 8 },
  option: { padding: 15, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: t.border, borderRadius: 15 },
  chosen: { backgroundColor: t.elevated, borderColor: t.accent },
  empty: { padding: 16, color: t.muted, lineHeight: 22 },
});
