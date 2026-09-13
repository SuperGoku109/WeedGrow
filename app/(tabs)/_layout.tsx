import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { IconSymbol } from '@/ui/IconSymbol';



export default function TabLayout() {

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#c8e78b',
        headerShown: false,
        tabBarInactiveTintColor: '#92a18d',
        tabBarLabelStyle: { fontSize: 10, lineHeight: 14, fontWeight: '600' },
        tabBarIconStyle: { height: 26 },
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarStyle: {
          backgroundColor: '#18261e',
          borderTopWidth: 1, borderTopColor: '#34432f', height: 66, paddingTop: 8, paddingBottom: 10,
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
