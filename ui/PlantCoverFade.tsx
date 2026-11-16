import React from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** The cover treatment is identical during the photo flight and on the banner. */
export default function PlantCoverFade({ surface }: { surface: string }) {
  return <>
    <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFillObject} />
    <LinearGradient pointerEvents="none" colors={['transparent', surface]} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 28 }} />
  </>;
}
