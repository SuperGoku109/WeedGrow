import React from 'react';
import { View, useWindowDimensions } from 'react-native';

/** Short related fields share a row; larger accessibility text stacks them. */
export default function EditorRow({ children }: { children: React.ReactNode }) {
  const { fontScale } = useWindowDimensions();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 }}>{React.Children.toArray(children).filter(Boolean).map((child, index) => <View key={index} style={{ flex: 1, minWidth: fontScale > 1.2 ? '100%' : 128 }}>{child}</View>)}</View>;
}
