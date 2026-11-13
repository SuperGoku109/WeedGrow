import React from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { Plant } from '@/firestoreModels';
import { growthPhase } from '@/lib/plants/growthPhase';
import { plantAgeLabel } from '@/lib/plants/plantAge';
import { guideTabs, type GrowthGuideStage } from '../growthStagePresentation';
import type { PlantTheme } from './plantDetailTheme';

const STEP_WIDTH = 64;
export default function GrowthStageTimeline({ plant, selectedStage, onSelect, theme: t }: { plant: Plant; selectedStage: GrowthGuideStage; onSelect(stage: GrowthGuideStage): void; theme: PlantTheme }) {
  const reduced = useReducedMotion();
  const scroll = React.useRef<ScrollView>(null);
  const [width, setWidth] = React.useState(0);
  const [contentWidth, setContentWidth] = React.useState(0);
  const [offset, setOffset] = React.useState(0);
  const stages = guideTabs(plant);
  const currentIndex = stages.findIndex(item => item.key === growthPhase(plant));
  const selectedIndex = stages.findIndex(item => item.key === selectedStage);
  const selectionX = React.useRef(new Animated.Value(selectedIndex * STEP_WIDTH)).current;
  const previousIndex = React.useRef(selectedIndex);
  React.useEffect(() => {
    const target = selectedIndex * STEP_WIDTH;
    if (reduced) { selectionX.setValue(target); return; }
    const animation = Animated.spring(selectionX, { toValue: target, stiffness: 240, damping: 26, mass: 1, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [selectedIndex, reduced, selectionX]);
  const centreSelection = React.useCallback(() => {
    if (width) {
      scroll.current?.scrollTo({ x: Math.max(0, selectedIndex * STEP_WIDTH - (width - STEP_WIDTH) / 2), animated: !reduced && previousIndex.current !== selectedIndex });
      previousIndex.current = selectedIndex;
    }
  }, [selectedIndex, width, reduced]);
  React.useEffect(centreSelection, [centreSelection]);
  const maximumOffset = Math.max(0, contentWidth - width);
  const canGoBack = width > 0 && maximumOffset > 2 && offset > 2;
  const canGoForward = width > 0 && offset < maximumOffset - 2;
  const move = (direction: -1 | 1) => scroll.current?.scrollTo({ x: Math.max(0, Math.min(maximumOffset, offset + direction * Math.max(STEP_WIDTH, width * .65))), animated: !reduced });
  return <View style={{ backgroundColor: t.surface, borderRadius: 22, borderWidth: 1, borderColor: t.elevated, overflow: 'hidden' }}>
    <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <MaterialCommunityIcons name="leaf" size={20} color={t.accent} accessible={false} />
      <Text style={{ flex: 1, color: t.text, fontSize: 14, fontWeight: '600' }}>Growth stage</Text>
      <Text accessibilityLabel={`Plant age: ${plantAgeLabel(plant)}`} style={{ color: t.muted, fontSize: 12 }}>{plantAgeLabel(plant, undefined, true)} old</Text>
    </View>
    <View>
    <ScrollView horizontal ref={scroll} accessibilityRole="tablist" showsHorizontalScrollIndicator={false} onLayout={event => setWidth(event.nativeEvent.layout.width)} onContentSizeChange={value => { setContentWidth(value); centreSelection(); }} onScroll={event => setOffset(event.nativeEvent.contentOffset.x)} scrollEventThrottle={32} contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 8 }}>
      <Animated.View pointerEvents="none" accessible={false} style={{ position: 'absolute', left: 18, top: 12, width: 44, height: 44, borderRadius: 24, backgroundColor: t.elevated, transform: [{ translateX: selectionX }] }} />
      <Animated.View pointerEvents="none" accessible={false} style={{ position: 'absolute', left: 26, bottom: 9, width: 28, height: 2, borderRadius: 2, backgroundColor: t.accent, transform: [{ translateX: selectionX }] }} />
      {stages.map((item, index) => {
        const isCurrent = item.key === growthPhase(plant);
        const isSelected = item.key === selectedStage;
        return <View key={item.key} style={{ width: STEP_WIDTH }}>
          {index > 0 && <View pointerEvents="none" style={{ position: 'absolute', top: 21, left: 0, width: STEP_WIDTH / 2, height: 1, backgroundColor: index <= currentIndex ? t.accent : t.border, opacity: index <= currentIndex ? .65 : .4 }} />}
          {index < stages.length - 1 && <View pointerEvents="none" style={{ position: 'absolute', top: 21, right: 0, width: STEP_WIDTH / 2, height: 1, backgroundColor: index < currentIndex ? t.accent : t.border, opacity: index < currentIndex ? .65 : .4 }} />}
          <Pressable accessibilityRole="tab" accessibilityLabel={`${item.title}${isCurrent ? ', current stage' : ''}`} accessibilityHint="Shows this stage’s guide. Your plant’s recorded stage stays the same." accessibilityState={{ selected: isSelected }} aria-selected={isSelected} onPress={() => onSelect(item.key)} style={({ pressed }) => ({ minHeight: 80, alignItems: 'center', gap: 4, opacity: pressed ? .7 : 1 })}>
            <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: isCurrent ? 36 : 28, height: isCurrent ? 36 : 28, borderRadius: 24, borderWidth: isCurrent || isSelected ? 2 : 1, borderColor: isCurrent || isSelected ? t.accent : t.border, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', boxShadow: isCurrent ? `0px 0px 16px ${t.accent}55` : undefined }}>
                <MaterialCommunityIcons name={item.icon} size={isCurrent ? 22 : 16} color={isCurrent || isSelected ? t.accent : t.muted} accessible={false} />
              </View>
            </View>
            <View style={{ maxWidth: STEP_WIDTH, paddingHorizontal: 3, paddingVertical: 4, borderRadius: 12, backgroundColor: isCurrent ? t.accent : 'transparent' }}><Text style={{ color: isCurrent ? t.onAccent : isSelected ? t.accent : t.muted, fontSize: 10.5, lineHeight: 14, fontWeight: isCurrent || isSelected ? '600' : '400', textAlign: 'center' }}>{item.key === 'preflower' ? 'Pre-\nflowering' : item.title}</Text></View>
          </Pressable>
        </View>;
      })}
    </ScrollView>
    {canGoBack && <Pressable accessibilityRole="button" accessibilityLabel="Show earlier growth stages" onPress={() => move(-1)} hitSlop={10} style={({ pressed }) => ({ position: 'absolute', left: 0, top: 12, width: 28, height: 44, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}><MaterialCommunityIcons name="chevron-left" size={21} color={t.accent} /></Pressable>}
    {canGoForward && <Pressable accessibilityRole="button" accessibilityLabel="Show later growth stages" onPress={() => move(1)} hitSlop={10} style={({ pressed }) => ({ position: 'absolute', right: 0, top: 12, width: 28, height: 44, backgroundColor: t.surface, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1 })}><MaterialCommunityIcons name="chevron-right" size={21} color={t.accent} /></Pressable>}
    </View>
  </View>;
}
