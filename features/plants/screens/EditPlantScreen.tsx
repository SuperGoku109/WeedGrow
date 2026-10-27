import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
// Keep existing deep links working while all edits use the profile section editor.
export default function EditPlantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/plant/[id]', params: { id, section: 'Details', editSection: 'choose' } }} />;
}
