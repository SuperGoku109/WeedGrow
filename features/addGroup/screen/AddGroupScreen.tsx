import React from 'react';
import { ScrollView, View, TextInput, Text } from 'react-native';
import { Button } from 'react-native-paper';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { PlantSelection } from '../components/PlantSelection';
import HomeBackground from '@/features/home/components/HomeBackground';
import { ThemedText } from '@/ui/ThemedText';
import { CollectionButton, ink } from '@/features/groups/components/CollectionUI';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAddGroup } from '../hooks/useAddGroup';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getGroupById, updateGroup, type GroupWithId } from '@/features/groups/api/groupApi';

export default function AddGroupScreen() {
  const theme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();

  const {
    plants,
    loading,
    error,
    selectedPlantIds,
    groupLocationPlantId,
    setGroupLocationPlantId,
    groupName,
    setGroupName,
    submitting,
    submitError,
    handleTogglePlant,
    handleCreateGroup,
  } = useAddGroup();

  // Local state for add-to-group mode
  const [existingGroup, setExistingGroup] = React.useState<GroupWithId | null>(null);
  const [groupLoading, setGroupLoading] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const addLock = React.useRef(false);
  const isAddToGroupMode = Boolean(groupId);

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      if (!groupId) return;
      try {
        setGroupLoading(true);
        const g = await getGroupById(String(groupId));
        if (active) setExistingGroup(g);
        if (active && !g) setSaveError('This group could not be found. Go back to your collections.');
      } catch {
        if (active) setSaveError('Could not load this group. Go back and try again.');
      } finally {
        if (active) setGroupLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [groupId]);

  // Compute available plants in add-to-group mode (same env and not already in group)
  const availablePlants = React.useMemo(() => {
    // IMPORTANT: In add-to-group mode, don't expose any plants until the group is fully loaded to avoid UI flicker
    if (!isAddToGroupMode) return plants;
    if (groupLoading || !existingGroup) return [];
    const currentIds = new Set(existingGroup.plantIds || []);
    return plants.filter((p) => p.environment === existingGroup.environment && !currentIds.has(p.id));
  }, [plants, existingGroup, isAddToGroupMode, groupLoading]);

  const onPrimaryAction = React.useCallback(async () => {
    if (isAddToGroupMode) {
      if (addLock.current) return;
      if (!existingGroup || selectedPlantIds.length === 0) {
        router.back();
        return;
      }
      try {
        addLock.current = true;
        setAdding(true);
        setSaveError('');
        const nextIds = Array.from(new Set([...(existingGroup.plantIds || []), ...selectedPlantIds]));
        await updateGroup(existingGroup.id, { plantIds: nextIds });
        router.replace({ pathname: '/group/[id]', params: { id: existingGroup.id } });
      } catch {
        setSaveError('Could not add these plants. Your selection is saved here; try again.');
      } finally {
        addLock.current = false;
        setAdding(false);
      }
      return;
    }
    // Default create-group action
    handleCreateGroup();
  }, [isAddToGroupMode, existingGroup, selectedPlantIds, router, handleCreateGroup]);

  const primaryLabel = submitting || adding ? 'Saving…' : isAddToGroupMode ? 'Add to group' : 'Create group';
  const title = isAddToGroupMode ? 'Add Plants to Group' : 'Create Group';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[theme].background }}>
      <HomeBackground />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 22, width: '100%', maxWidth: 660, alignSelf: 'center', gap: 16, paddingBottom: 40 }}>
        <View style={{ alignSelf: 'flex-start' }}><CollectionButton label="Back to groups" icon="arrow-left" onPress={() => router.back()} disabled={submitting || adding} /></View>
        <Text style={{ color: ink.lime, fontSize: 10, letterSpacing: 2, marginTop: 12 }}>BETTER TOGETHER</Text>
        <ThemedText type="title" style={{ color: ink.text, fontSize: 34, lineHeight: 40, letterSpacing: -1 }}>
          {title}
        </ThemedText>
        {/* Show name input only when creating a group */}
        {!isAddToGroupMode && (
          <TextInput
            accessibilityLabel="Group name"
            placeholder="Give your collection a name"
            placeholderTextColor={ink.muted}
            maxLength={40}
            editable={!submitting}
            style={{ backgroundColor: ink.surface, color: ink.text, borderWidth: 1, borderColor: ink.border, borderRadius: 16, padding: 16, fontSize: 16 }}
            value={groupName}
            onChangeText={setGroupName}
          />
        )}
        <Text style={{ color: ink.muted, fontSize: 13, lineHeight: 21 }}>Choose the plants that belong together. Members share the same environment. Adding a plant moves it from its previous growing space.</Text>
        <Text style={{ color: ink.lime, fontSize: 13 }}>{selectedPlantIds.length} selected</Text>
        {!!(saveError || submitError) && <Text accessibilityRole="alert" style={{ color: '#f0b5a0', lineHeight: 20 }}>{saveError || submitError}</Text>}

        {(loading || groupLoading) && <Button loading>Loading Plants...</Button>}
        {!!error && <Button>{error}</Button>}

        {/* Plant selection or empty-state message in add-to-group mode */}
        {isAddToGroupMode ? (
          // Defer rendering the list until the group AND plants are loaded to prevent brief flash of unfiltered items
          (groupLoading || !existingGroup || loading) ? null : (
            availablePlants.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 24 }}>
                <ThemedText style={{ opacity: 0.8, textAlign: 'center' }}>
                  No more available plants to add that match this group environment.
                </ThemedText>
              </View>
            ) : (
              <PlantSelection
                plants={availablePlants}
                selectedPlantIds={selectedPlantIds}
                onTogglePlant={handleTogglePlant}
                {...{
                  allowedEnvironment: existingGroup?.environment,
                  disabledIds: existingGroup?.plantIds || [],
                }}
              />
            )
          )
        ) : (
          <PlantSelection
            plants={availablePlants}
            selectedPlantIds={selectedPlantIds}
            onTogglePlant={handleTogglePlant}
            {...{ groupLocationPlantId, onSelectGroupLocationPlantId: setGroupLocationPlantId }}
          />
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
          <CollectionButton label={primaryLabel} primary icon="check" onPress={onPrimaryAction}
            disabled={loading || submitting || adding || groupLoading || selectedPlantIds.length === 0 || (!isAddToGroupMode && !groupName.trim()) || (isAddToGroupMode && !existingGroup)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
