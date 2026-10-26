import React, { memo, useMemo, useState } from 'react';
import { FlatList, View, Pressable, StyleSheet, Text, TextInput, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native-paper';
import GroupCard from '../../groups/components/GroupCard';
import { CollectionButton, CollectionReveal, environments, ink } from '@/features/groups/components/CollectionUI';
import { selectGroups, type CollectionGroup, type CollectionPlant, type GroupEnvironment, type GroupSort } from '@/features/groups/groupCollection';

interface GroupListProps {
  groups: CollectionGroup[];
  groupPlantsMap: Record<string, CollectionPlant[]>;
  loading: boolean;
  error: string | null;
  onEditGroup: (group: CollectionGroup) => void;
  onAddGroup: () => void;
  onRefresh: () => void;
}

export default memo(function GroupList({ groups, groupPlantsMap, loading, error, onEditGroup, onAddGroup, onRefresh }: GroupListProps) {
  const [query, setQuery] = useState('');
  const [environment, setEnvironment] = useState<GroupEnvironment>('all');
  const [sort, setSort] = useState<GroupSort>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const shown = useMemo(() => selectGroups(groups, groupPlantsMap, query, environment, sort), [groups, groupPlantsMap, query, environment, sort]);
  const uniquePlants = useMemo(() => new Set(Object.values(groupPlantsMap).flat().map(p => p.id)).size, [groupPlantsMap]);
  const filtered = !!query.trim() || environment !== 'all';
  const clear = () => { setQuery(''); setEnvironment('all'); };
  const sortLabels: Record<GroupSort, string> = { name: 'Name A–Z', newest: 'Newest first', size: 'Most plants' };

  return <FlatList
    testID="home-groups-list"
    data={shown}
    keyExtractor={item => item.id}
    contentContainerStyle={styles.content}
    refreshing={loading && groups.length > 0}
    onRefresh={onRefresh}
    initialNumToRender={6}
    windowSize={5}
    keyboardShouldPersistTaps="handled"
    renderItem={({ item, index }) => <CollectionReveal delay={Math.min(index, 3) * 45}>
      <GroupCard group={item} plants={groupPlantsMap[item.id] || []} onEdit={() => onEditGroup(item)} />
    </CollectionReveal>}
    ListHeaderComponent={<View style={styles.header}>
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>YOUR COLLECTIONS</Text>
          <Text accessibilityRole="header" style={styles.title}>A place for{ '\n' }every plant.</Text>
        </View>
        <CollectionButton label="New group" icon="plus" primary onPress={onAddGroup} />
      </View>
      <Text style={styles.description}>Bring your plants together. Keep every space beautifully organised.</Text>
      <View style={styles.overview}>
        <Text style={styles.overviewText}><Text style={styles.number}>{groups.length}</Text> {groups.length === 1 ? 'group' : 'groups'}</Text>
        <View style={styles.divider} />
        <Text style={styles.overviewText}><Text style={styles.number}>{uniquePlants}</Text> plants grouped</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh groups" disabled={loading} onPress={onRefresh} style={styles.refresh}>
          {loading ? <ActivityIndicator size={16} color={ink.lime} /> : <MaterialCommunityIcons name="refresh" size={19} color={ink.muted} />}
        </Pressable>
      </View>
      <View style={styles.search}>
        <MaterialCommunityIcons name="magnify" size={21} color={ink.muted} />
        <TextInput accessibilityLabel="Search groups or plants" placeholder="Find a group or plant…" placeholderTextColor={ink.muted} value={query} onChangeText={setQuery} style={styles.input} />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear group search" onPress={() => setQuery('')} style={styles.clear}><MaterialCommunityIcons name="close" size={18} color={ink.text} /></Pressable>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {(['all', 'indoor', 'outdoor', 'greenhouse'] as const).map(value => {
          const selected = environment === value;
          const count = value === 'all' ? groups.length : groups.filter(g => g.environment === value).length;
          return <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 'all' ? 'All groups' : environments[value].label + ' groups'} accessibilityState={{ selected }}
            onPress={() => setEnvironment(value)} style={[styles.chip, selected && styles.selectedChip]}>
            <Text style={[styles.chipText, selected && { color: ink.dark }]}>{value === 'all' ? 'All spaces' : environments[value].label} <Text style={{ opacity: 0.65 }}> {count}</Text></Text>
          </Pressable>;
        })}
      </ScrollView>
      <View style={styles.resultRow}>
        <Text accessibilityLiveRegion="polite" style={styles.result}>{shown.length} {shown.length === 1 ? 'collection' : 'collections'}{filtered ? ' found' : ''}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Sort groups" accessibilityState={{ expanded: sortOpen }} onPress={() => setSortOpen(v => !v)} style={styles.sort}>
          <MaterialCommunityIcons name="sort" size={15} color={ink.muted} /><Text style={styles.result}>{sortLabels[sort]}</Text>
          <MaterialCommunityIcons name={sortOpen ? 'chevron-up' : 'chevron-down'} size={16} color={ink.muted} />
        </Pressable>
      </View>
      {sortOpen && <View style={styles.sortOptions}>
        {(Object.keys(sortLabels) as GroupSort[]).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: sort === value }} onPress={() => { setSort(value); setSortOpen(false); }} style={styles.sortOption}>
          <Text style={{ color: sort === value ? ink.lime : ink.text, fontSize: 13 }}>{sortLabels[value]}</Text>
          {sort === value && <MaterialCommunityIcons name="check" size={18} color={ink.lime} />}
        </Pressable>)}
      </View>}
      {!!error && <View style={styles.error}><Text accessibilityRole="alert" style={{ color: '#f0b5a0' }}>{error}</Text><CollectionButton label="Try again" onPress={onRefresh} /></View>}
    </View>}
    ListEmptyComponent={loading ? <View style={styles.empty}><ActivityIndicator color={ink.lime} /><Text style={styles.description}>Opening your collections…</Text></View> : error ? null : <CollectionReveal style={styles.empty}>
      <View style={styles.emptyIcon}><MaterialCommunityIcons name={filtered ? 'magnify' : 'view-grid-outline'} size={32} color={ink.lime} /></View>
      <Text style={styles.emptyTitle}>{filtered ? 'No matching spaces' : 'Your first collection starts here'}</Text>
      <Text style={styles.emptyCopy}>{filtered ? 'Try a different name or explore all your spaces.' : 'Create a group for a room, a corner, or a collection that belongs together.'}</Text>
      <CollectionButton label={filtered ? 'Clear filters' : 'Create a group'} icon={filtered ? 'filter-remove-outline' : 'plus'} primary onPress={filtered ? clear : onAddGroup} />
    </CollectionReveal>}
    ListFooterComponent={shown.length > 0 ? <View style={styles.footer}><MaterialCommunityIcons name="view-grid-outline" size={15} color={ink.muted} /><Text style={styles.footerText}>Each plant belongs to one growing space.</Text></View> : null}
  />;
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 36, gap: 14, flexGrow: 1 },
  header: { gap: 14, paddingTop: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { color: ink.lime, fontSize: 13, fontWeight: '700', letterSpacing: 2.3, marginBottom: 10 },
  title: { color: ink.text, fontSize: 32, lineHeight: 36, letterSpacing: -1.2, fontWeight: '500' },
  description: { color: ink.muted, fontSize: 13, lineHeight: 20 },
  overview: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4 },
  overviewText: { color: ink.muted, fontSize: 13 },
  number: { color: ink.text, fontSize: 19, fontWeight: '600' },
  divider: { width: 1, height: 20, backgroundColor: ink.border },
  refresh: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  search: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: ink.surface, borderWidth: 1, borderColor: ink.border, borderRadius: 16, paddingHorizontal: 14, minHeight: 50 },
  input: { color: ink.text, flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 14 },
  clear: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8 },
  chip: { minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: ink.border, paddingHorizontal: 14, justifyContent: 'center' },
  selectedChip: { backgroundColor: ink.lime, borderColor: ink.lime },
  chipText: { color: ink.muted, fontSize: 13, fontWeight: '600' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  result: { color: ink.muted, fontSize: 13 },
  sort: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 48 },
  sortOptions: { backgroundColor: ink.surface, borderRadius: 16, borderWidth: 1, borderColor: ink.border, padding: 6 },
  sortOption: { padding: 12, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24, gap: 16, borderRadius: 24, borderWidth: 1, borderColor: ink.border, backgroundColor: ink.surface },
  emptyIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: '#354734', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 23, color: ink.text, textAlign: 'center', fontWeight: '600', letterSpacing: -0.5 },
  emptyCopy: { fontSize: 13, lineHeight: 21, color: ink.muted, textAlign: 'center', maxWidth: 320 },
  error: { gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#42352c' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 18 },
  footerText: { color: ink.muted, fontSize: 13, flexShrink: 1 },
});
