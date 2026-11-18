import React from 'react';
import { SharedHero } from 'react-native-shared-hero';
import { Platform, View, type ViewProps } from 'react-native';

export default function PlantPhotoHero({ id, children, ...props }: ViewProps & { id: string }) {
  // Android uses the app's coordinated photo flight to time the image and scene together.
  if (Platform.OS === 'android') return <View {...props}>{children}</View>;
  return <SharedHero id={id} mode="morph" motionPath="arc" spring={{ damping: 24, stiffness: 260, mass: 1 }} {...props}>{children}</SharedHero>;
}
