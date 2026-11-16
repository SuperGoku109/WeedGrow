import { useAppTheme } from '@/hooks/useAppTheme';
import type { GardenTheme } from '@/design-system/tokens/garden';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/services/session';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { OverflowMenuButton, type MenuAnchor } from './AnchoredActionMenu';
export function AppHeader({ showDate = true, onActions, actionsOpen }: { showDate?: boolean; onActions?(anchor: MenuAnchor): void; actionsOpen?: boolean }) {
  const t = useAppTheme();
  const s = makeStyles(t);
  const { user } = useSession();
  return <View style={s.row}>
    <View style={s.logo}><MaterialCommunityIcons name="sprout" size={22} color={t.accent} /></View>
    <Text style={s.name}>BudBuddy<Text style={{ color: t.accent }}>.</Text></Text>
    <View style={{ flex: 1 }} />
    {showDate && <Text style={s.date}>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}</Text>}
    {onActions && <OverflowMenuButton label="Garden and plant actions" onOpen={onActions} expanded={actionsOpen} disabled={!user} horizontal />}
  </View>;
}
const makeStyles = (t: GardenTheme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 6, gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 11, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] },
  name: { fontSize: 23, fontWeight: '800', letterSpacing: -1, color: t.text },
  date: { fontSize: 12, color: t.muted, letterSpacing: 0.5 },
});
export default AppHeader;
