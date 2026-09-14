// GroupScreenLayout.tsx
// This component provides a consistent layout for group-related screens.
// It handles loading state, missing group state, and wraps content optionally in a scrollable safe area.

import React, { memo } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native-paper';
import { ThemedText } from '@/ui/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Props for the GroupScreenLayout component
interface GroupScreenLayoutProps {
  loading: boolean;
  groupExists: boolean;
  children: React.ReactNode;
  // When false, children are rendered without a ScrollView to avoid nesting FlatList inside ScrollView
  scrollable?: boolean;
}

const GroupScreenLayout = memo(function GroupScreenLayout({ loading, groupExists, children, scrollable = true }: GroupScreenLayoutProps) {
  const theme = (useColorScheme() ?? 'dark') as keyof typeof Colors;

  // Show loading spinner if loading
  if (loading && !groupExists) {
    return (
      <SafeAreaView edges={['top','bottom']} style={[styles.flex1, { backgroundColor: Colors[theme].background }]}> 
        <View style={styles.center}><ActivityIndicator color={Colors[theme].tint} /></View>
      </SafeAreaView>
    );
  }

  // Show message if group does not exist
  if (!groupExists) {
    return (
      <SafeAreaView edges={['top','bottom']} style={[styles.flex1, { backgroundColor: Colors[theme].background }]}> 
        <View style={styles.center}><ThemedText>Group not found.</ThemedText></View>
      </SafeAreaView>
    );
  }

  // Render children either in a scrollable container or plain view to avoid nested lists
  return (
    <SafeAreaView edges={['top','bottom']} style={[styles.flex1, { backgroundColor: Colors[theme].background }]}> 
      {scrollable ? (
        <ScrollView contentContainerStyle={styles.container}>
          {children}
        </ScrollView>
      ) : (
        <View style={styles.nonScrollableContainer}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
});

export default GroupScreenLayout;

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: { padding: 20, gap: 16, flexGrow: 1, width: '100%' },
  nonScrollableContainer: { padding: 0, gap: 0, flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', backgroundColor: '#15231c' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
