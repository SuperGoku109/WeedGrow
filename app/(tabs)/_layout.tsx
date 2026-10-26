import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/ui/IconSymbol';



export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#c8e78b',
        headerShown: false,
        tabBarInactiveTintColor: '#bac8b3',
        tabBarLabelStyle: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
        tabBarIconStyle: { height: 26 },
        tabBarItemStyle: { paddingVertical: 0, borderRadius: 16, marginHorizontal: 8 },
        tabBarActiveBackgroundColor: '#2e4434',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#18261e',
          borderTopWidth: 1, borderTopColor: '#40523a', height: 72 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(8, insets.bottom),
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: 'Profiles',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-cog" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="ellipsis.circle" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
