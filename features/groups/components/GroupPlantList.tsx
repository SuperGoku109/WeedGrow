// GroupPlantList.tsx
// This component displays a list of plants belonging to a group.
// Each plant is shown as a row with its image, name, and growth stage, and is clickable to view plant details.

import React, { memo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, FlatList, ScrollView } from 'react-native';
import { ThemedText } from '@/ui/ThemedText';
import type { Plant } from '@/firestoreModels';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PlantCard } from '@/features/plants/components/PlantCard';
import { Swipeable } from 'react-native-gesture-handler';

interface GroupPlantListProps {
  searchActive?: boolean;
  onClearSearch?: () => void;
  plants: (Plant & { id: string })[];
  groupId?: string;
  onAddPlant?: () => void;
  onCreatePlant?: () => void;
  // Optional header to render above the list using ListHeaderComponent
  header?: React.ReactElement | null;
  // When true and header is provided, make the header sticky
  stickyHeader?: boolean;
  // Control whether to show the footer Add Plant button
  showFooterAddButton?: boolean;
  // Additional bottom inset to avoid overlapping nav/tab bars
  bottomInset?: number;
  // Pull-to-refresh
  refreshing?: boolean;
  onRefresh?: () => void;
  // Actions
  onRemovePlant?: (plantId: string) => void;
  onQuickWater?: (plantId: string) => Promise<void> | void;
  onQuickFeed?: (plantId: string) => void;
  onQuickNote?: (plantId: string) => void;
  onMoveUp?: (plantId: string) => void;
  onMoveDown?: (plantId: string) => void;
  wateredMap?: Record<string, boolean>;
  waterLoadingMap?: Record<string, boolean>;
}

const RightActions = ({
  onRemove,
  onQuickWater,
  onQuickFeed,
  onQuickNote,
  waterDisabled,
}: {
  onRemove?: () => void;
  onQuickWater?: () => void;
  onQuickFeed?: () => void;
  onQuickNote?: () => void;
  waterDisabled?: boolean;
}) => (
  <View style={styles.rightActionsContainer}>
    {onRemove && <TouchableOpacity style={[styles.actionBtn, styles.removeBtn]} onPress={onRemove} accessibilityLabel="Remove from group">
      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fecaca" />
      <ThemedText style={styles.actionText}>Remove</ThemedText>
    </TouchableOpacity>}
    <TouchableOpacity
      style={[styles.actionBtn, styles.waterBtn, waterDisabled && styles.disabledAction]}
      onPress={onQuickWater}
      accessibilityLabel="Quick water"
      disabled={waterDisabled}
    >
      <MaterialCommunityIcons name="water" size={20} color="#dbeafe" />
      <ThemedText style={styles.actionText}>Water</ThemedText>
    </TouchableOpacity>
    {onQuickFeed && <TouchableOpacity style={[styles.actionBtn, styles.feedBtn]} onPress={onQuickFeed} accessibilityLabel="Quick feed">
      <MaterialCommunityIcons name="leaf" size={20} color="#fde68a" />
      <ThemedText style={styles.actionText}>Feed</ThemedText>
    </TouchableOpacity>}
    {onQuickNote && <TouchableOpacity style={[styles.actionBtn, styles.noteBtn]} onPress={onQuickNote} accessibilityLabel="Quick note">
      <MaterialCommunityIcons name="note-edit-outline" size={20} color="#e5e7eb" />
      <ThemedText style={styles.actionText}>Note</ThemedText>
    </TouchableOpacity>}
  </View>
);

const LeftActions = ({ onMoveUp, onMoveDown }: { onMoveUp?: () => void; onMoveDown?: () => void }) => (
  <View style={styles.leftActionsContainer}>
    <TouchableOpacity style={[styles.actionBtn, styles.reorderBtn]} onPress={onMoveUp} accessibilityLabel="Move up">
      <MaterialCommunityIcons name="arrow-up" size={20} color="#d1fae5" />
      <ThemedText style={styles.actionText}>Up</ThemedText>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.actionBtn, styles.reorderBtn]} onPress={onMoveDown} accessibilityLabel="Move down">
      <MaterialCommunityIcons name="arrow-down" size={20} color="#d1fae5" />
      <ThemedText style={styles.actionText}>Down</ThemedText>
    </TouchableOpacity>
  </View>
);

const GroupPlantList = memo(function GroupPlantList({
  plants,
  onAddPlant,
  onCreatePlant,
  header,
  stickyHeader = false,
  showFooterAddButton = true,
  bottomInset = 0,
  refreshing,
  onRefresh,
  onRemovePlant,
  onQuickWater,
  onQuickFeed,
  onQuickNote,
  onMoveUp,
  onMoveDown,
  wateredMap = {},
  waterLoadingMap = {},
  groupId,
  searchActive,
  onClearSearch,
}: GroupPlantListProps) {
  const router = useRouter();
  const navigateToAddPlant = useCallback(() => {
    if (onAddPlant) return onAddPlant();
    router.push('/add-plant');
  }, [router, onAddPlant]);
  const navigateToCreatePlant = useCallback(() => {
    if (onCreatePlant) return onCreatePlant();
    router.push('/add-plant');
  }, [router, onCreatePlant]);

  const navigateToPlantDetail = useCallback((plantId: string) => {
    if (!groupId) {
      router.push({ pathname: '/plant/[id]', params: { id: plantId } });
      return;
    }
    router.push({ pathname: '/plant/[id]', params: { id: plantId, fromGroupId: groupId } });
  }, [router, groupId]);

  if (!plants || plants.length === 0) {
    return (
      <ScrollView contentContainerStyle={[styles.emptyContainer, { paddingBottom: 24 + bottomInset }]}> 
        {header}
        <ThemedText style={styles.emptyText}>{searchActive ? 'No plants match your search.' : 'No plants in this group yet.'}</ThemedText>
        {searchActive ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear plant search" onPress={onClearSearch} style={styles.addPlantButton}><ThemedText>Clear search</ThemedText></TouchableOpacity> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
          <TouchableOpacity accessibilityLabel="Add existing plants" onPress={navigateToAddPlant} style={styles.addPlantButton}>
            <MaterialCommunityIcons name="plus" size={24} color="#fff" style={{ marginRight: 4 }} />
            <ThemedText style={styles.addPlantText}>Add Plants</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Create new plant" onPress={navigateToCreatePlant} style={[styles.addPlantButton, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
            <MaterialCommunityIcons name="sprout" size={24} color="#fff" style={{ marginRight: 4 }} />
            <ThemedText style={styles.addPlantText}>Create Plant</ThemedText>
          </TouchableOpacity>
        </View>}
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={{ flex: 1 }}
      data={plants}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        (onRemovePlant || onQuickWater || onQuickFeed || onQuickNote || onMoveUp || onMoveDown) ? (
          <Swipeable
            renderRightActions={() => (
              <RightActions
                onRemove={onRemovePlant ? () => onRemovePlant(item.id) : undefined}
                onQuickWater={onQuickWater ? () => onQuickWater(item.id) : undefined}
                onQuickFeed={onQuickFeed ? () => onQuickFeed(item.id) : undefined}
                onQuickNote={onQuickNote ? () => onQuickNote(item.id) : undefined}
                waterDisabled={!!waterLoadingMap[item.id] || !!wateredMap[item.id]}
              />
            )}
            renderLeftActions={onMoveUp || onMoveDown ? () => (
              <LeftActions
                onMoveUp={onMoveUp ? () => onMoveUp(item.id) : undefined}
                onMoveDown={onMoveDown ? () => onMoveDown(item.id) : undefined}
              />
            ) : undefined}
            overshootRight={false}
            overshootLeft={false}
          >
            <PlantCard
              plant={item}
              onPress={() => navigateToPlantDetail(item.id)}
              onAddLog={onQuickWater ? () => onQuickWater(item.id) : undefined}
              wateredToday={!!wateredMap[item.id]}
              waterLoading={!!waterLoadingMap[item.id]}
            />
          </Swipeable>
        ) : (
          <PlantCard
            plant={item}
            onPress={() => navigateToPlantDetail(item.id)}
            wateredToday={!!wateredMap[item.id]}
            waterLoading={!!waterLoadingMap[item.id]}
          />
        )
      )}
      ListHeaderComponent={header ?? undefined}
      ListHeaderComponentStyle={header ? { backgroundColor: 'transparent' } : undefined}
      stickyHeaderIndices={header && stickyHeader ? [0] : undefined}
      ListFooterComponent={showFooterAddButton ? (
        <View style={{ alignItems: 'center', marginTop: 16, marginBottom: bottomInset }}>
          <TouchableOpacity accessibilityLabel="Add Plant" onPress={navigateToAddPlant} style={styles.addPlantButton}>
            <MaterialCommunityIcons name="plus" size={24} color="#fff" style={{ marginRight: 4 }} />
            <ThemedText style={styles.addPlantText}>Add Plant</ThemedText>
          </TouchableOpacity>
        </View>
      ) : <View style={{ height: bottomInset }} />}
      contentContainerStyle={[styles.listContent, { paddingBottom: 24 + bottomInset }]}
      removeClippedSubviews
      initialNumToRender={8}
      windowSize={10}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  );
});

export default GroupPlantList;

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  emptyContainer: {
    paddingHorizontal: 16,
    gap: 18,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 12,
  },
  addPlantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 28,
    marginTop: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 6,
  },
  addPlantText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 10,
    letterSpacing: 0.4,
  },
  rightActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '90%',
    alignSelf: 'center',
    marginRight: 12,
    gap: 8,
  },
  leftActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '90%',
    alignSelf: 'center',
    marginLeft: 12,
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  removeBtn: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderColor: 'rgba(239,68,68,0.25)',
  },
  waterBtn: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.25)',
  },
  feedBtn: {
    backgroundColor: 'rgba(234,179,8,0.12)',
    borderColor: 'rgba(234,179,8,0.25)',
  },
  noteBtn: {
    backgroundColor: 'rgba(107,114,128,0.12)',
    borderColor: 'rgba(107,114,128,0.25)',
  },
  reorderBtn: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderColor: 'rgba(16,185,129,0.25)',
  },
  actionText: {
    color: '#e5e7eb',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 2,
  },
  disabledAction: {
    opacity: 0.4,
  },
});
