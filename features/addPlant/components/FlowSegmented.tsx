import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon, palette, type IconName } from './FlowUI';

export default function FlowSegmented({ label, options, value, onChange }: {
  label: string; options: readonly { value: string; label: string; icon?: IconName }[];
  value: string; onChange(value: string): void;
}) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', padding: 4, gap: 4, borderWidth: 1, borderColor: palette.border, borderRadius: 14, backgroundColor: palette.input }}>
    {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 7, paddingVertical: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: value === option.value ? palette.panel : 'transparent', opacity: pressed ? 0.7 : 1 })}>
      {!!option.icon && <Icon name={option.icon} size={18} color={value === option.value ? palette.accent : palette.muted} />}<Text style={{ flexShrink: 1, textAlign: 'center', color: value === option.value ? palette.accent : palette.muted, fontSize: 14, fontWeight: value === option.value ? '600' : '400' }}>{option.label}</Text>
    </Pressable>)}
  </View>;
}
