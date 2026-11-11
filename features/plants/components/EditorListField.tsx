import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { EditorField } from './PlantEditorFields';
import type { PlantTheme } from './plantDetailTheme';

const itemsFrom = (value: string) => {
  const seen = new Set<string>();
  return value.split(',').map(item => item.trim()).filter(item => {
    const key = item.toLocaleLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key); return true;
  });
};
export default function EditorListField({ label, value, onChange, disabled, theme: t }: { label: string; value: string; onChange(value: string): void; disabled: boolean; theme: PlantTheme }) {
  const [items, setItems] = React.useState(() => itemsFrom(value));
  const [entry, setEntry] = React.useState('');
  const emitted = React.useRef(value);
  React.useEffect(() => {
    if (value !== emitted.current) { emitted.current = value; setItems(itemsFrom(value)); setEntry(''); }
  }, [value]);
  const emit = (nextItems: string[], nextEntry = '') => {
    const next = itemsFrom([...nextItems, nextEntry].join(', ')).join(', ');
    emitted.current = next; onChange(next);
  };
  const add = () => {
    if (disabled || !entry.trim()) return;
    const next = itemsFrom([...items, entry].join(', '));
    setItems(next); setEntry(''); emit(next);
  };
  return <View style={{ gap: 10 }}>
    <EditorField label={label} value={entry} editable={!disabled} maxLength={120} returnKeyType="done" onChangeText={raw => { setEntry(raw); emit(items, raw); }} onSubmitEditing={add} suffixControl={
      <Pressable accessibilityRole="button" accessibilityLabel={'Add to ' + label.toLowerCase()} disabled={disabled || !entry.trim()} onPress={add} style={{ minHeight: 40, margin: 4, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center', backgroundColor: t.elevated, opacity: disabled || !entry.trim() ? .45 : 1 }}><Text style={{ color: t.accent, fontSize: 13, fontWeight: '600' }}>Add</Text></Pressable>
    } />
    {!!items.length && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{items.map((item, index) => <View key={item} style={{ maxWidth: '100%', flexDirection: 'row', alignItems: 'center', paddingLeft: 12, borderRadius: 12, backgroundColor: t.elevated }}>
      <Text style={{ color: t.text, fontSize: 13, lineHeight: 20, flexShrink: 1, paddingVertical: 8 }}>{item}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={'Remove ' + item + ' from ' + label.toLowerCase()} disabled={disabled} hitSlop={4} onPress={() => { const next = items.filter((_, i) => i !== index); setItems(next); emit(next, entry); }} style={{ minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center', opacity: disabled ? .45 : 1 }}><Feather name="x" size={15} color={t.muted} /></Pressable>
    </View>)}</View>}
  </View>;
}
