import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@/services/session';
import { MaterialCommunityIcons } from '@expo/vector-icons';
export function AppHeader() {
  const router = useRouter();
  const { user } = useSession();
  return <View style={s.row}>
    <View style={s.logo}><MaterialCommunityIcons name="sprout" size={22} color="#c8e78b" /></View>
    <Text style={s.name}>weedgrow<Text style={{ color: '#c8e78b' }}>.</Text></Text>
    <View style={{ flex: 1 }} />
    <Text style={s.date}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Manage garden account' : 'Sign in to your garden'} onPress={() => router.push('/account')} style={[s.badge, { width: 44, height: 44 }]}><MaterialCommunityIcons name={user ? 'account-check-outline' : 'account-outline'} size={22} color="#c8e78b" /></Pressable>
  </View>;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, gap: 9 },
  logo: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#273a2c', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  name: { fontSize: 23, fontWeight: '800', letterSpacing: -1, color: '#f0f1e5' },
  date: { fontSize: 12, color: '#bac8b3', letterSpacing: 0.5 },
  badge: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#354332', justifyContent: 'center', alignItems: 'center' },
});
export default AppHeader;
