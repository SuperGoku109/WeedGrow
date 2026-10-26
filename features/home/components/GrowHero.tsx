import React from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GrowPress, GrowReveal, useReducedMotion } from '@/ui/GrowMotion';
export default function GrowHero({ plants, groups, attention }: { plants: number | null; groups: number | null; attention: number }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const compact = width < 600;
  const reduced = useReducedMotion();
  const drift = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (reduced) { drift.setValue(0); return; }
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(drift, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])); motion.start(); return () => motion.stop();
  }, [drift, reduced]);
  return <GrowReveal style={[s.hero, compact && { minHeight: 0, marginHorizontal: 0, borderRadius: 20 }]}>
    <View style={[s.copy, compact && { padding: 18, paddingBottom: 18 }]}>
      {!compact && <Text style={s.eyebrow}>YOUR PERSONAL GROW SPACE</Text>}
      <Text accessibilityRole="header" style={[s.headline, compact && { fontSize: 28, lineHeight: 34 }]}>{compact ? 'Your garden' : <>A little care.{'\n'}<Text style={s.italic}>A lot of growth.</Text></>}</Text>
      <View style={s.bottom}>
        <Text style={s.sub}>{plants ?? '—'} {plants === 1 ? 'plant' : 'plants'} · {groups ?? '—'} {groups === 1 ? 'space' : 'spaces'}</Text>
        <GrowPress accessibilityRole="button" accessibilityLabel="Add a plant" onPress={() => router.push('/add-plant')} style={s.add}><MaterialCommunityIcons name="plus" size={18} color="#eaf0d5" /><Text style={s.addLabel}>New plant</Text></GrowPress>
      </View>
    </View>
    {!compact && <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.art, { transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [3, -5] }) }, { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) }] }]}>
      <Svg width="150" height="178" viewBox="0 0 180 210">
        <Circle cx="95" cy="98" r="73" fill="#dfe9bc" />
        <Circle cx="95" cy="98" r="85" stroke="#90a16b" strokeWidth="0.7" strokeDasharray="3 6" fill="none" />
        <Ellipse cx="91" cy="188" rx="38" ry="6" fill="#bdcb9c" />
        <Path d="M92 155 Q83 103 101 40" stroke="#30472b" strokeWidth="4" fill="none" />
        <G fill="#385c37">
          <Path d="M94 107 Q42 115 37 64 Q83 61 94 107" />
          <Path d="M94 83 Q127 91 151 47 Q108 43 94 83" />
          <Path d="M98 61 Q72 33 103 13 Q123 40 98 61" />
          <Path d="M92 140 Q119 148 137 108 Q103 103 92 140" />
        </G>
        <Path d="M43 72 L91 105 M100 79 L144 53 M97 133 L131 114" stroke="#a5be76" strokeWidth="1.2" fill="none" />
        <Path d="M62 150 L121 150 L112 185 Q91 195 72 185 Z" fill="#cc714b" />
        <Path d="M60 148 Q91 142 123 148 L121 157 L62 157 Z" fill="#e58e62" />
        <Path d="M76 161 L79 180 M85 161 L86 183" stroke="#f2b087" strokeWidth="2" />
        <Path d="M150 132 L153 123 L156 132 L165 135 L156 138 L153 147 L150 138 L141 135 Z" fill="#a0b459" />
        <Circle cx="31" cy="132" r="4" fill="#cc714b" />
      </Svg>
    </Animated.View>}
    {!compact && <View style={s.status}><View style={[s.dot, { backgroundColor: attention ? '#cf805c' : '#aeca77' }]} /><Text style={s.statusText}>{attention ? `${attention} plants need a little love` : 'Make room for something good'}</Text></View>}
  </GrowReveal>;
}
const s = StyleSheet.create({
  hero: { marginHorizontal: 18, marginBottom: 12, borderRadius: 26, backgroundColor: '#eaf0d5', overflow: 'hidden', minHeight: 238 },
  copy: { padding: 20, paddingBottom: 47, zIndex: 1 },
  eyebrow: { fontFamily: 'SpaceMono', fontSize: 8, letterSpacing: 1.3, color: '#586547', marginBottom: 10 },
  headline: { color: '#243420', fontSize: 29, lineHeight: 32, fontWeight: '700', letterSpacing: -1.3 },
  italic: { fontStyle: 'italic', fontWeight: '400' },
  sub: { color: '#4b5b3b', fontSize: 14, flexShrink: 1 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#243420', borderRadius: 30, paddingHorizontal: 12, paddingVertical: 8 },
  addLabel: { color: '#eaf0d5', fontSize: 14, fontWeight: '700' },
  art: { position: 'absolute', right: -8, top: 23 },
  status: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, height: 33, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#dce5c4' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, color: '#4b5b3b', fontWeight: '500' },
});
