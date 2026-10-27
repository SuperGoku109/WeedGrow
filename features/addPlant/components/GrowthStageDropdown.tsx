import React from 'react';
import { stages } from '../plantFlowModel';
import FlowDropdown from './FlowDropdown';

export default function GrowthStageDropdown({ value, onChange }: { value: string; onChange(value: string): void }) {
  return <FlowDropdown label="Current growth stage" placeholder="Select growth stage" options={stages} value={value} onChange={onChange} />;
}
