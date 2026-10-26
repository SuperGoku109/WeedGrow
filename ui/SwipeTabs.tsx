import * as React from 'react';
import { View, StyleSheet, useWindowDimensions, Text, Pressable } from 'react-native';
import { TabView } from 'react-native-tab-view';
import { useReducedMotion } from './GrowMotion';
interface SwipeTabsProps {
  tabs: { key: string; title: string; render: () => React.ReactNode }[];
  initialKey?: string; index?: number; onIndexChange?: (idx: number) => void;
}
export default function SwipeTabs({ tabs, initialKey, index: controlledIndex, onIndexChange }: SwipeTabsProps) {
  const layout = useWindowDimensions();
  const [uncontrolledIndex, setUncontrolledIndex] = React.useState(initialKey ? Math.max(0, tabs.findIndex(t => t.key === initialKey)) : 0);
  const index = controlledIndex ?? uncontrolledIndex;
  const setIndex = onIndexChange || setUncontrolledIndex;
  const reduced = useReducedMotion();
  const routes = tabs.map(({ key, title }) => ({ key, title }));
  return <TabView navigationState={{ index, routes }}
    renderScene={({ route }) => tabs.find(tab => tab.key === route.key)?.render() ?? null}
    lazy lazyPreloadDistance={0} onIndexChange={setIndex} initialLayout={{ width: layout.width }} swipeEnabled animationEnabled={!reduced}
    renderTabBar={() => <View style={s.bar}>
      {routes.map((route, i) => <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: index === i }} onPress={() => setIndex(i)} style={[s.tab, index === i && { backgroundColor: '#c8e78b', borderRadius: 13 }]}>
        <Text style={[s.label, index === i && s.active]}>{route.title}</Text>
      </Pressable>)}
    </View>} />;
}
const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    position: 'relative',
    minHeight: 56,
    marginHorizontal: 18,
    marginBottom: 10,
    padding: 4,
    backgroundColor: '#1d2c23',
    borderWidth: 1,
    borderColor: '#354332',
    borderRadius: 17,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  label: {
    color: '#9eae96',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  active: { color: '#243420' },
});
