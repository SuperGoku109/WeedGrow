import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Pattern, Path, Rect } from 'react-native-svg';
export default function HomeBackground() {
  return <View style={StyleSheet.absoluteFillObject} pointerEvents="none"><Svg width="100%" height="100%">
    <Defs>
      <RadialGradient id="growGlow"><Stop offset="0" stopColor="#739249" stopOpacity="0.16" /><Stop offset="1" stopColor="#739249" stopOpacity="0" /></RadialGradient>
      <Pattern id="growGrid" width="44" height="44" patternUnits="userSpaceOnUse"><Path d="M44 0H0V44" stroke="#abc394" strokeOpacity="0.035" fill="none" /></Pattern>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#growGrid)" /><Circle cx="85%" cy="30%" r="300" fill="url(#growGlow)" />
  </Svg></View>;
}
