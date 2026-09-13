import React, { useCallback, memo } from 'react';
import { FlatList, View, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native-paper';
import { ThemedText } from '@/ui/ThemedText';
import GroupCard from '../../groups/components/GroupCard';
import type { Group, Plant } from '@/firestoreModels';

interface GroupListProps {
  groups: (Group & { id: string })[];
  groupPlantsMap: Record<string, (Plant & { id: string })[]>;
  loading: boolean;
  error: string | null;
  onEditGroup: (group: Group & { id: string }) => void;
  onAddGroup: () => void;
  theme: string;
}

const GroupList = memo(function GroupList({
  groups,
  groupPlantsMap,
  loading,
  error,
  onEditGroup,
  onAddGroup,
  theme,
}: GroupListProps) {
  const getOnEditGroup = useCallback(
    (group: Group & { id: string }) => () => onEditGroup(group),
    [onEditGroup]
  );

  const renderItem = useCallback(
    ({ item: group }: { item: Group & { id: string } }) => {
      const groupPlants = groupPlantsMap[group.id] || [];
      return <GroupCard group={group} plants={groupPlants} onEdit={getOnEditGroup(group)} />;
    },
    [groupPlantsMap, getOnEditGroup]
  );

  const renderEmpty = useCallback(() => {
    if (error) return <ThemedText>Error: {error}</ThemedText>;
    // Only show empty message if not loading and no groups
    if (!loading) {
      return (
        <View style={styles.emptyContainer}>
          <ThemedText style={styles.emptyText}>
            No groups yet.{"\n"}Tap Add Group below to get started.
          </ThemedText>
        </View>
      );
    }
    // Otherwise, render nothing (spinner is handled by overlay)
    return null;
  }, [error, loading]);

  const renderFooter = useCallback(() => (
    <View style={styles.footerContainer}>
      <TouchableOpacity
        accessibilityLabel="Add Group"
        onPress={onAddGroup}
        style={styles.addGroupButton}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" style={{ marginRight: 4 }} />
        <ThemedText style={styles.addGroupText}>Add Group</ThemedText>
      </TouchableOpacity>
    </View>
  ), [onAddGroup]);

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <FlatList
        testID="home-groups-list"
        data={groups}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.contentContainer}
      />
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <View style={styles.loadingSpinnerContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        </View>
      )}
    </View>
  );
});

export default GroupList;

const styles = StyleSheet.create({
  loading: { marginTop: 20 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 31, 27, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    flex: 1,
  },
  loadingSpinnerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 32,
    borderRadius: 28,
    marginTop: 0,
    marginBottom: 8,
    backgroundColor: '#2d3e29',
    borderWidth: 1,
    borderColor: '#536344',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 6,
  },
  addGroupText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
});
