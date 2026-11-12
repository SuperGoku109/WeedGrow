import React, { useState } from 'react';
import { GrowCollapse, GrowPress, GrowRotate } from './GrowMotion';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';

interface CollapsibleProps {
  title: string;
  children: React.ReactNode;
}

export function Collapsible({ title, children }: CollapsibleProps) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    setOpen((o) => !o);
  };

  return (
    <View style={styles.container}>
      <GrowPress onPress={toggle} style={styles.header} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <GrowRotate expanded={open}><MaterialCommunityIcons
          name="chevron-down"
          size={24}
          color="#aaa"
        /></GrowRotate>
      </GrowPress>
      <GrowCollapse open={open}><View style={styles.content}>{children}</View></GrowCollapse>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#181a1b',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#222',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    padding: 16,
    backgroundColor: '#181a1b',
  },
});
