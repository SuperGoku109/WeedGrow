import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { fetchGrowingSpaces, type GrowingSpace } from '../api/growingSpaces';
import { useSession } from '@/services/session';
import { Choices, Press, Section, palette, s } from './FlowUI';
import type { StepProps } from './FlowSteps';
export default function GrowingSpacePicker({ form, setField, errors, onSignIn }: StepProps) {
  const { user } = useSession();
  const [spaces, setSpaces] = React.useState<GrowingSpace[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [attempt, setAttempt] = React.useState(0);
  React.useEffect(() => {
    let active = true;
    setSpaces([]); setError('');
    if (!user) { setLoading(false); return; }
    setLoading(true);
    fetchGrowingSpaces().then(items => { if (active) setSpaces(items); }).catch(() => { if (active) setError('Your growing spaces could not be loaded. Retry, or set up this plant separately.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, attempt]);
  const choose = (id: string) => {
    const space = spaces.find(item => item.id === id);
    setField('groupId', space?.id || ''); setField('groupName', space?.name || '');
    if (!space) { setField('locationMode', 'custom'); return; }
    setField('locationMode', 'space');
    setField('environment', space.environment);
    setField('location', space.location || null);
    setField('latitudeInput', space.location ? String(space.location.lat) : '');
    setField('longitudeInput', space.location ? String(space.location.lng) : '');
    setField('locationNickname', space.name);
    setField('locationLabel', space.locationLabel || space.name);
    setField('sensorProfileId', space.sensorProfileId || '');
  };
  return <Section title="Garden" subtitle="Reuse your garden’s environment, location and sensor profile.">
    {!user ? <><Text style={s.hint}>Sign in to choose one of your existing spaces. You can also continue with a separate setup.</Text>{onSignIn && <Press label="Sign in to choose a growing space" onPress={onSignIn} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Sign in</Text></Press>}</> : loading ? <ActivityIndicator color={palette.accent} /> : error ? <><Text style={s.error}>{error}</Text><Press label="Retry growing spaces" onPress={() => setAttempt(value => value + 1)} style={[s.button, s.secondary]}><Text style={s.secondaryText}>Retry</Text></Press></> : <Choices options={[{ value: '', label: 'Separate setup' }, ...spaces.map(space => ({ value: space.id, label: space.name }))]} value={form.groupId || ''} onChange={choose} />}
    {!!form.groupId && <Text style={s.hint}>This plant will be added to {form.groupName || 'your selected garden'}. You can adjust its individual details below.</Text>}
    {!!errors.groupId && <Text accessibilityRole="alert" style={s.error}>{errors.groupId}</Text>}
    {user && !loading && !error && !spaces.length && <Text style={s.hint}>No growing spaces yet. Add this plant on its own, then organize it into a space from your garden.</Text>}
  </Section>;
}
