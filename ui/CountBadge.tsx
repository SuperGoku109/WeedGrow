import React from 'react';
import { Text, View } from 'react-native';

/** Numeric indicators stay circular, including counts with multiple digits. */
export default function CountBadge({ value, label, color, backgroundColor, size = 26, fontSize = 12 }: {
  value: number | string; label?: string; color: string; backgroundColor: string; size?: number; fontSize?: number;
}) {
  const text = String(value);
  const diameter = Math.max(size, Math.ceil(text.length * fontSize * .64) + 12);
  return <View accessible accessibilityLabel={label || text} style={{ width: diameter, height: diameter, borderRadius: diameter / 2, backgroundColor, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{ color, fontSize, fontWeight: '600', lineHeight: fontSize + 4, fontVariant: ['tabular-nums'], textAlign: 'center' }}>{text}</Text>
  </View>;
}
