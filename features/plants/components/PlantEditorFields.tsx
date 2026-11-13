import { gardenControls } from '@/design-system/tokens/garden';
import React from 'react';
import { Animated, Keyboard, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AnchoredSelectMenu from '@/ui/AnchoredSelectMenu';
import type { MenuAnchor } from '@/ui/AnchoredActionMenu';
import { useReducedMotion } from '@/ui/GrowMotion';
import { plantThemes, type PlantTheme } from './plantDetailTheme';

const t = plantThemes.grove;
export const EditorTheme = React.createContext<PlantTheme>(t);

export function EditorField({ label, error, helper, suffix, suffixControl, inputRef, hideLabel = false, ...props }: TextInputProps & { label: string; error?: string; helper?: string; suffix?: string; suffixControl?: React.ReactNode; inputRef?: React.Ref<TextInput>; hideLabel?: boolean }) {
  const t = React.useContext(EditorTheme);
  const reduced = useReducedMotion();
  const inputId = React.useId();
  const focus = React.useRef(new Animated.Value(0)).current;
  const animate = (value: number) => {
    focus.stopAnimation();
    Animated.timing(focus, { toValue: value, duration: reduced ? 0 : 160, useNativeDriver: false }).start();
  };
  React.useEffect(() => () => focus.stopAnimation(), [focus]);
  return <View style={s.field}>
    {!hideLabel && <Text style={[s.label, { color: t.muted }]}>{label}</Text>}
    <Animated.View style={[s.inputFrame, { backgroundColor: t.surface, opacity: props.editable === false ? 0.55 : 1, borderColor: focus.interpolate({ inputRange: [0, 1], outputRange: [error ? t.danger : t.border, error ? t.danger : t.accent] }) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><TextInput {...props} nativeID={props.nativeID || `editor-input-${inputId}`} underlineColorAndroid="transparent" ref={inputRef} accessibilityLabel={label} accessibilityHint={error || helper || (suffix ? `Value in ${suffix}.` : undefined)} aria-invalid={!!error} placeholderTextColor={t.muted} selectionColor={t.accent}
        onFocus={event => { animate(1); props.onFocus?.(event); }}
        onBlur={event => { animate(0); props.onBlur?.(event); }} style={[s.input, { color: t.text, flex: 1, width: undefined }, props.style]} />{suffixControl || (suffix && <View style={[s.unit, { backgroundColor: t.elevated }]}><Text style={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>{suffix}</Text></View>)}</View>
    </Animated.View>
    {!!(error || helper) && <Text accessibilityRole={error ? "alert" : undefined} style={{ color: error ? t.danger : t.muted, fontSize: 13, lineHeight: 19 }}>{error || helper}</Text>}
  </View>;
}

export function EditorSelect({ label, value, options, onSelect, placeholder, disabled = false }: {
  label: string; value: string; options: { label: string; value: string }[]; onSelect: (value: string) => void; placeholder?: string; disabled?: boolean;
}) {
  const [anchor, setAnchor] = React.useState<MenuAnchor | null>(null);
  const trigger = React.useRef<View>(null);
  const measuring = React.useRef(0);
  const t = React.useContext(EditorTheme);
  const close = React.useCallback(() => { measuring.current++; setAnchor(null); trigger.current?.focus?.(); }, []);
  React.useEffect(() => { if (disabled) { measuring.current++; setAnchor(null); } }, [disabled]);
  React.useEffect(() => () => { measuring.current++; }, []);
  const selected = options.find(option => option.value === value);
  const show = () => {
    if (disabled) return;
    Keyboard.dismiss();
    const request = ++measuring.current;
    trigger.current?.measureInWindow((x, y, width, height) => {
      if (request === measuring.current && width > 0 && height > 0) setAnchor({ x, y, width, height });
    });
  };
  return <View style={s.field}>
    <Text style={[s.label, { color: t.muted }]}>{label}</Text>
    <Pressable ref={trigger} collapsable={false} accessibilityRole="button" accessibilityLabel={label + ': ' + (selected?.label || value || placeholder || 'Not set')} disabled={disabled} accessibilityState={{ expanded: !!anchor, disabled }} onPress={show}
      style={({ pressed }) => [s.select, { backgroundColor: t.surface, borderColor: anchor ? t.accent : t.border, opacity: disabled ? .5 : pressed ? .75 : 1 }]}>
      <Text style={[s.value, { color: value ? t.text : t.muted }]}>{selected?.label || value || placeholder || 'Not set'}</Text><Feather name={anchor ? 'chevron-up' : 'chevron-down'} size={18} color={t.muted} />
    </Pressable>
    {anchor && <AnchoredSelectMenu anchor={anchor} label={label} value={value} options={options} theme={t} onClose={close} onSelect={onSelect} />}
  </View>;
}

const s = StyleSheet.create({
  field: { gap: 5, minWidth: 0 },
  label: { color: t.muted, fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },
  inputFrame: { borderWidth: 1, borderRadius: 12, backgroundColor: t.background, overflow: 'hidden' },
  input: { color: t.text, fontSize: 16, minHeight: gardenControls.fieldHeight, paddingHorizontal: 12, paddingVertical: 10, minWidth: 0, borderWidth: 0, backgroundColor: 'transparent', width: '100%' },
  unit: { minHeight: 28, minWidth: 30, paddingHorizontal: 7, marginRight: 8, borderRadius: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  select: { borderWidth: 1, borderRadius: 12, backgroundColor: t.background, minHeight: gardenControls.fieldHeight, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  value: { color: t.text, fontSize: 15, lineHeight: 22, flex: 1 },
});
