import React from 'react';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';

export function HapticTab({ children, ...props }: BottomTabBarButtonProps) {
  return (
    <PlatformPressable
      {...props}
      onPress={(e) => {
        if (props.onPress) props.onPress(e);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { /* Haptics are optional on unsupported devices. */ });
      }}
    >
      {children}
    </PlatformPressable>
  );
}
