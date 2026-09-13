import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
export function AppHeader() {
  return <View style={s.row}>
    <View style={s.logo}><MaterialCommunityIcons name="sprout" size={22} color="#c8e78b" /></View>
    <Text style={s.name}>weedgrow<Text style={{ color: '#c8e78b' }}>.</Text></Text>
    <View style={{ flex: 1 }} />
    <Text style={s.date}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</Text>
    <View style={s.badge}><MaterialCommunityIcons name="white-balance-sunny" size={17} color="#c8e78b" /></View>
  </View>;
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 17, gap: 9 },
  logo: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#273a2c', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  name: { fontSize: 23, fontWeight: '800', letterSpacing: -1, color: '#f0f1e5' },
  date: { fontFamily: 'SpaceMono', fontSize: 9, color: '#a2b19a', letterSpacing: 1 },
  badge: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#354332', justifyContent: 'center', alignItems: 'center' },
});
export default AppHeader;
