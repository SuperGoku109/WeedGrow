import { useAppTheme } from '@/hooks/useAppTheme';
import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/ui/IconSymbol';
import { GrowTabIcon, useReducedMotion } from '@/ui/GrowMotion';



export default function TabLayout() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: t.background },
        animation: reduced ? 'none' : 'fade',
        transitionSpec: { animation: 'timing', config: { duration: reduced ? 0 : 180 } },
        tabBarActiveTintColor: t.accent,
        headerShown: false,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
        tabBarIconStyle: { height: 26 },
        tabBarItemStyle: { paddingVertical: 0, borderRadius: 16, marginHorizontal: 8 },
        tabBarActiveBackgroundColor: t.elevated,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopWidth: 1, borderTopColor: t.elevated, height: 64 + insets.bottom, paddingTop: 4, paddingBottom: Math.max(4, insets.bottom),
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <GrowTabIcon focused={focused}><IconSymbol size={24} name="house.fill" color={color} /></GrowTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: 'Profiles',
          tabBarIcon: ({ color, size, focused }) => (
            <GrowTabIcon focused={focused}><MaterialCommunityIcons name="account-cog" color={color} size={size} /></GrowTabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <GrowTabIcon focused={focused}><IconSymbol size={24} name="ellipsis.circle" color={color} /></GrowTabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
