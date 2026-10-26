import { gardenLayout, gardenThemes } from '@/design-system/tokens/garden';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
/** A stable layout while the first snapshot arrives; no artificial load delay
 * or perpetual shimmer. Existing content should stay mounted during refresh. */
export default function LoadingState({ label, onBack }: { label: string; onBack?: () => void }) {
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => { const timer = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(timer); }, []);
  return <View style={s.container} accessibilityState={{ busy: true }}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: 14 }}>
      <View style={[s.placeholder, { height: 24, width: '42%' }]} />
      <View style={[s.placeholder, { height: 14, width: '68%' }]} />
      <View style={[s.placeholder, { height: 140, marginTop: 12 }]} />
      <View style={[s.placeholder, { height: 90 }]} />
    </View>
    <View style={s.status}><ActivityIndicator color={gardenThemes.grove.accent} /><Text accessibilityLiveRegion="polite" style={s.text}>{label}</Text></View>
    {slow && <Text accessibilityLiveRegion="polite" style={s.hint}>This is taking longer than usual. Check your connection, or go back and try again.</Text>}
    {onBack && <Pressable accessibilityRole="button" onPress={onBack} style={s.back}><Text style={s.text}>Back to garden</Text></Pressable>}
  </View>;
}
const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', width: '100%', maxWidth: gardenLayout.contentWidth, alignSelf: 'center', padding: 28, gap: 20 },
  placeholder: { backgroundColor: gardenThemes.grove.surface, borderRadius: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { color: gardenThemes.grove.accent, fontSize: 15, flexShrink: 1 },
  hint: { color: gardenThemes.grove.muted, lineHeight: 22 },
  back: { minHeight: gardenLayout.touchTarget, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 20 },
});
