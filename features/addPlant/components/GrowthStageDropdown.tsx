import React from 'react';
import { stages } from '../plantFlowModel';
import FlowDropdown from './FlowDropdown';

export default function GrowthStageDropdown({ value, onChange, compact = false }: { value: string; onChange(value: string): void; compact?: boolean }) {
  return <FlowDropdown compact={compact} label="Current growth stage" placeholder="Select growth stage" options={stages} value={value} onChange={onChange} />;
}
