import * as React from 'react';
import { View, StyleSheet, useWindowDimensions, Text, Pressable, Animated } from 'react-native';
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
  const [barWidth, setBarWidth] = React.useState(0);
  const reduced = useReducedMotion();
  const slide = React.useRef(new Animated.Value(index)).current;
  React.useEffect(() => {
    if (reduced) { slide.setValue(index); return; }
    const spring = Animated.spring(slide, { toValue: index, stiffness: 230, damping: 22, mass: 0.9, useNativeDriver: true });
    spring.start(); return () => spring.stop();
  }, [index, reduced, slide]);
  const routes = tabs.map(({ key, title }) => ({ key, title }));
  // Account for the track's border and padding so the sliding pill stays
  // perfectly inset at both ends of the control.
  const cellWidth = Math.max(0, (barWidth - 10) / Math.max(tabs.length, 1));
  return <TabView navigationState={{ index, routes }}
    renderScene={({ route }) => tabs.find(tab => tab.key === route.key)?.render() ?? null}
    onIndexChange={setIndex} initialLayout={{ width: layout.width }} swipeEnabled animationEnabled={!reduced}
    renderTabBar={() => <View style={s.bar} onLayout={e => setBarWidth(e.nativeEvent.layout.width)}>
      <Animated.View pointerEvents="none" style={[s.indicator, { width: cellWidth, transform: [{ translateX: Animated.multiply(slide, cellWidth) }] }]} />
      {routes.map((route, i) => <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: index === i }} onPress={() => setIndex(i)} style={s.tab}>
        <Text style={[s.label, index === i && s.active]}>{route.title}</Text>
      </Pressable>)}
    </View>} />;
}
const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    position: 'relative',
    minHeight: 48,
    marginHorizontal: 18,
    marginBottom: 10,
    padding: 4,
    backgroundColor: '#1d2c23',
    borderWidth: 1,
    borderColor: '#354332',
    borderRadius: 17,
  },
  indicator: {
    position: 'absolute',
    left: 5,
    top: 4,
    bottom: 4,
    backgroundColor: '#c8e78b',
    borderWidth: 1,
    borderColor: '#dcebb4',
    borderRadius: 13,
    shadowColor: '#8eb657',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
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
    fontSize: 13,
    letterSpacing: 0.2,
  },
  active: { color: '#243420' },
});
