import React from 'react';
import { View } from 'react-native';
import { EditorField, EditorSelect } from './PlantEditorFields';

const sizes = ['1L', '5L', '10L', '20L', '50L'];
export default function EditorPotSize({ value, onChange, disabled }: { value: string; onChange(value: string): void; disabled: boolean }) {
  const [custom, setCustom] = React.useState(!!value && !sizes.includes(value));
  return <View style={{ gap: 12 }}><EditorSelect label="Pot size" value={custom ? 'custom' : value} disabled={disabled} options={[{ value: '', label: 'Not specified' }, ...sizes.map(size => ({ value: size, label: size })), { value: 'custom', label: 'Custom size' }]} onSelect={next => { setCustom(next === 'custom'); if (next !== 'custom') onChange(next); }} />{custom && <EditorField label="Custom pot size" placeholder="e.g. 15L or 3 gallons" value={value} onChangeText={onChange} editable={!disabled} maxLength={40} />}</View>;
}
