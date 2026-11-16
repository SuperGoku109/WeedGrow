import React from 'react';
import { SharedHero } from 'react-native-shared-hero';
import type { ViewProps } from 'react-native';

export default function PlantPhotoHero({ id, children, ...props }: ViewProps & { id: string }) {
  return <SharedHero id={id} mode="morph" motionPath="arc" spring={{ damping: 24, stiffness: 260, mass: 1 }} {...props}>{children}</SharedHero>;
}
