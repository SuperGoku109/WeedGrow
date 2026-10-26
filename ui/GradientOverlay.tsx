import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function GradientOverlay({ style, color }: { style?: StyleProp<ViewStyle>; color: string }) {
  // More visible white-to-transparent overlay for card highlight
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.10)', color]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}
