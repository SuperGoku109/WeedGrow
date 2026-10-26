import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
export default function LegacyJournalRoute() {
  const params = useLocalSearchParams<{ plantId?: string; id?: string }>();
  const value = params.plantId || params.id; const id = Array.isArray(value) ? value[0] : value;
  return id ? <Redirect href={{ pathname: '/plant/[id]', params: { id, section: 'Journal', returnToPlants: '1' } }} /> : <Redirect href="/(tabs)?tabIndex=1" />;
}
