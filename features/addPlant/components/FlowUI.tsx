import { gardenFlowPalette as palette } from '@/design-system/tokens/garden';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { useReducedMotion } from '@/ui/GrowMotion';

export { gardenFlowPalette as palette } from '@/design-system/tokens/garden';
export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
export const ValidationContext = createContext<{ target?: string; revision: number; root?: React.RefObject<View | null>; reveal?: (y: number) => void }>({ revision: 0 });
export function ValidationTarget({ name, children, focus }: { name?: string; children: React.ReactNode; focus?: () => void }) {
  const context = useContext(ValidationContext);
  const ref = useRef<View>(null);
  useEffect(() => {
    if (!name || context.target !== name || !context.root?.current) return;
    const frame = requestAnimationFrame(() => {
      ref.current?.measureLayout(context.root!.current!, (_x, y) => { context.reveal?.(Math.max(0, y - 20)); focus?.(); }, () => focus?.());
    });
    return () => cancelAnimationFrame(frame);
  }, [name, context, focus]);
  return <View ref={ref} collapsable={false}>{children}</View>;
}
export const Icon = ({ name, size = 22, color = palette.accent }: { name: IconName; size?: number; color?: string }) => <MaterialCommunityIcons name={name} size={size} color={color} />;

export function Press({ children, onPress, label, selected, expanded, disabled, style, containerStyle }: { children: React.ReactNode; onPress(): void; label: string; selected?: boolean; expanded?: boolean; disabled?: boolean; style?: ViewStyle | ViewStyle[]; containerStyle?: ViewStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const animate = (toValue: number) => { if (!reduced) Animated.spring(scale, { toValue, speed: 35, bounciness: 3, useNativeDriver: Platform.OS !== 'web' }).start(); };
  return <Animated.View style={[{ transform: [{ scale }], flexShrink: 1 }, containerStyle]}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, expanded, disabled }} disabled={disabled} onPress={onPress} onPressIn={() => animate(0.975)} onPressOut={() => animate(1)} style={({ pressed, hovered }) => [{ minWidth: 48, minHeight: 48 }, style, hovered && !disabled && { borderColor: palette.accent }, pressed && { opacity: 0.85 }, disabled && !selected && { opacity: 0.5 }]}>{children}</Pressable></Animated.View>;
}

export function Field({ label, hint, error, optional, fieldKey, ...props }: TextInputProps & { label: string; hint?: string; error?: string; optional?: boolean; fieldKey?: string }) {
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);
  const focus = React.useCallback(() => input.current?.focus(), []);
  return <ValidationTarget name={fieldKey} focus={focus}><View style={s.field}><View style={s.labelRow}><Text style={s.label}>{label}</Text>{optional && <Text style={s.optional}>Optional</Text>}</View><TextInput {...props} ref={input} accessibilityLabel={label} accessibilityHint={error || hint} placeholderTextColor={palette.muted} selectionColor={palette.accent} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[s.input, props.multiline && { minHeight: 108, textAlignVertical: 'top' }, focused && { borderColor: palette.accent, backgroundColor: '#203329' }, error && { borderColor: palette.error }, props.style]} />{(hint || error) && <Text accessibilityLiveRegion="polite" style={[s.hint, error ? { color: palette.error } : undefined]}>{error || hint}</Text>}</View></ValidationTarget>;
}

export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <View style={s.section}><View style={{ gap: 5 }}><Text style={s.sectionTitle}>{title}</Text>{subtitle && <Text style={s.hint}>{subtitle}</Text>}</View>{children}</View>;
}

export function Choices({ options, value, onChange, multiple = false }: { options: readonly (string | { value: string; label: string; icon?: string; detail?: string })[]; value: string | string[]; onChange(value: string): void; multiple?: boolean }) {
  const { width } = useWindowDimensions();
  return <View style={s.choices}>{options.map(option => {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    const selected = Array.isArray(value) ? value.includes(item.value) : value === item.value;
    return <Press key={item.value} label={item.label} selected={selected} onPress={() => onChange(item.value)} containerStyle={item.detail ? { flexBasis: width < 600 ? '100%' : '47%', flexGrow: 1 } : undefined} style={[s.choice, selected ? s.choiceSelected : {}, item.detail ? s.detailedChoice : {}]}>
      {item.icon && <View style={[s.choiceIcon, selected ? { backgroundColor: '#d0e8a0' } : {}]}><Icon name={item.icon as IconName} color={selected ? palette.dark : palette.accent} size={25} /></View>}
      <View style={{ flexShrink: 1, gap: 4 }}><Text style={[s.choiceLabel, selected && { color: palette.accent }]}>{item.label}</Text>{item.detail && <Text style={s.hint}>{item.detail}</Text>}</View>
      {(selected || multiple) && <Icon name={selected ? 'check-circle' : 'plus'} size={17} color={selected ? palette.accent : palette.muted} />}
    </Press>;
  })}</View>;
}

export function Disclosure({ title, subtitle, children, initiallyOpen = false, forceOpen = false }: { title: string; subtitle?: string; children: React.ReactNode; initiallyOpen?: boolean; forceOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const { revision } = useContext(ValidationContext);
  useEffect(() => { if (forceOpen) setOpen(true); }, [forceOpen, revision]);
  return <View style={s.disclosure}><Press label={title} expanded={open} onPress={() => setOpen(!open)} style={s.disclosureHeader}><View style={{ flex: 1, gap: 5 }}><Text style={s.label}>{title}</Text>{subtitle && <Text style={s.hint}>{subtitle}</Text>}</View><Icon name={open ? 'minus' : 'plus'} size={20} /></Press>{open && <View style={{ padding: 18, paddingTop: 0, gap: 22 }}>{children}</View>}</View>;
}

export function PlantIllustration({ stage = 'seedling' }: { stage?: string }) {
  return <Svg width="170" height="174" viewBox="0 0 200 200">
    <Circle cx="100" cy="92" r="77" fill="#dbe4bf" />
    <Circle cx="100" cy="92" r="63" fill="none" stroke="#bfcca6" strokeDasharray="3 6" />
    <Ellipse cx="102" cy="179" rx="48" ry="7" fill="#c2ceaa" />
    <Path d="M73 141 H133 L123 174 Q103 182 83 174Z" fill="#9d6548" />
    <Path d="M70 140 Q101 132 136 140 L134 150 Q102 156 72 150Z" fill="#bd8661" />
    <Path d="M102 142 Q108 108 100 65" fill="none" stroke="#536b3b" strokeWidth="4" strokeLinecap="round" />
    <Path d="M104 117 Q65 122 57 83 Q98 82 104 117Z" fill="#6f874b" />
    <Path d="M104 99 Q143 103 151 62 Q115 63 104 99Z" fill="#49693d" />
    <Path d="M100 77 Q73 61 88 30 Q116 52 100 77Z" fill="#90a968" />
    <Path d="M65 90 L102 117 M142 72 L107 99" stroke="#b7c58b" strokeWidth="1.4" fill="none" />
    {stage === 'flowering' && <><Circle cx="100" cy="43" r="17" fill="#d6ab99" /><Circle cx="100" cy="43" r="7" fill="#e8cf8a" /></>}
    <Path d="M153 119 h10 M158 114 v10 M42 61 h8 M46 57 v8" stroke="#879660" strokeWidth="2" strokeLinecap="round" />
  </Svg>;
}

export const s = StyleSheet.create({
  field: { gap: 8 }, labelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, label: { color: palette.ink, fontSize: 15, fontWeight: '600' }, optional: { fontSize: 13, color: palette.muted },
  input: { borderWidth: 1, borderColor: palette.border, borderRadius: 13, color: palette.ink, paddingHorizontal: 15, paddingVertical: 14, minHeight: 52, fontSize: 16, backgroundColor: palette.input },
  hint: { color: palette.muted, fontSize: 14, lineHeight: 21 }, section: { gap: 16 }, sectionTitle: { color: palette.ink, fontSize: 18, fontWeight: '600', letterSpacing: -0.4 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, choice: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15, minHeight: 48, backgroundColor: palette.input },
  detailedChoice: { minWidth: 220, flexGrow: 1, padding: 15 }, choiceSelected: { backgroundColor: '#2c402b', borderColor: '#b6ce88' }, choiceLabel: { color: palette.ink, fontSize: 14, fontWeight: '500' }, choiceIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2c4030' },
  disclosure: { borderWidth: 1, borderColor: palette.border, borderRadius: 16, overflow: 'hidden' }, disclosureHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18 },
  button: { minHeight: 52, borderRadius: 14, backgroundColor: palette.accent, paddingHorizontal: 24, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: palette.accent }, buttonText: { color: palette.dark, fontSize: 15, fontWeight: '700' },
  secondary: { backgroundColor: 'transparent', borderColor: palette.border }, secondaryText: { color: palette.ink }, error: { color: palette.error, fontSize: 14, lineHeight: 21 },
});
