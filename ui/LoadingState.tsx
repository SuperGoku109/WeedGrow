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
    <View style={s.status}><ActivityIndicator color="#c8e78b" /><Text accessibilityLiveRegion="polite" style={s.text}>{label}</Text></View>
    {slow && <Text accessibilityLiveRegion="polite" style={s.hint}>This is taking longer than usual. Check your connection, or go back and try again.</Text>}
    {onBack && <Pressable accessibilityRole="button" onPress={onBack} style={s.back}><Text style={s.text}>Back to garden</Text></Pressable>}
  </View>;
}
const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', width: '100%', maxWidth: 760, alignSelf: 'center', padding: 28, gap: 20 },
  placeholder: { backgroundColor: '#23342a', borderRadius: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { color: '#d2e4a2', fontSize: 15, flexShrink: 1 },
  hint: { color: '#bdcbb7', lineHeight: 22 },
  back: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 20 },
});
