import React from 'react';
import { View, type ViewProps } from 'react-native';

/** Web keeps the existing Reanimated overlay transition. */
export default function PlantPhotoHero({ id: _id, children, ...props }: ViewProps & { id: string }) {
  return <View {...props}>{children}</View>;
}
