import React from 'react';
import { View } from 'react-native';
import { potSizeOptions } from '../api/environmentApi';
import { Field, Section } from './FlowUI';
import FlowDropdown from './FlowDropdown';

export default function PotSizeField({ value, onChange }: { value: string; onChange(value: string): void }) {
  const [custom, setCustom] = React.useState(!!value && !potSizeOptions.includes(value));
  return <Section title="Pot size · optional"><FlowDropdown label="Pot size" placeholder="Not specified" value={custom ? 'custom' : value} options={[{ value: '', label: 'Not specified' }, ...potSizeOptions.map(size => ({ value: size, label: size })), { value: 'custom', label: 'Custom size' }]}
    onChange={next => { setCustom(next === 'custom'); if (next !== 'custom') onChange(next); }} />
    {custom && <View><Field label="Custom pot size" placeholder="e.g. 15L or 3 gallons" value={value} onChangeText={onChange} maxLength={40} /></View>}
  </Section>;
}
