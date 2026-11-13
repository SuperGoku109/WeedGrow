import { useAppTheme } from '@/hooks/useAppTheme';
import type { GardenTheme } from '@/design-system/tokens/garden';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/services/session';
import { MaterialCommunityIcons } from '@expo/vector-icons';
export function AppHeader() {
  const t = useAppTheme();
  const s = makeStyles(t);
  const router = useRouter();
  const { user } = useSession();
  return <View style={s.row}>
    <View style={s.logo}><MaterialCommunityIcons name="sprout" size={22} color={t.accent} /></View>
    <Text style={s.name}>BudBuddy<Text style={{ color: t.accent }}>.</Text></Text>
    <View style={{ flex: 1 }} />
    <Text style={s.date}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Manage garden account' : 'Sign in to your garden'} onPress={() => router.push('/account')} hitSlop={4} style={[s.badge, { width: 40, height: 40 }]}><MaterialCommunityIcons name={user ? 'account-check-outline' : 'account-outline'} size={22} color={t.accent} /></Pressable>
  </View>;
}
const makeStyles = (t: GardenTheme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 11, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  name: { fontSize: 23, fontWeight: '800', letterSpacing: -1, color: t.text },
  date: { fontSize: 12, color: t.muted, letterSpacing: 0.5 },
  badge: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: t.border, justifyContent: 'center', alignItems: 'center' },
});
export default AppHeader;
