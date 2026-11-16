import React from 'react';
import PlantCoverFade from './PlantCoverFade';
import { Image, StyleSheet, View } from 'react-native';
import Reanimated, { cancelAnimation, Easing, makeMutable, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { coverTransform, entrancePhase, photoProgress, PLANT_ENTRANCE_MS, plantEntrance, type ImageFrame } from './plantEntrance';

type Flight = { id: string; uri: string; frame: ImageFrame };
const emptyFrame: ImageFrame = { x: 0, y: 0, width: 1, height: 1 };
const idleTimeline = makeMutable(1);
const Context = React.createContext({ active: false, contentReady: true, previewUri: '', timeline: idleTimeline as SharedValue<number>, start: (_id: string, _uri: string, _frame: ImageFrame) => {}, arrive: (_id: string, _frame: ImageFrame) => {} });
export const usePlantImageTransition = () => React.useContext(Context);

/** One UI-thread clock owns photo travel, crop, treatment, chrome and handoff. */
export default function PlantImageTransitionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const theme = useAppTheme();
  const [contentReady, setContentReady] = React.useState(true);
  const [flight, setFlight] = React.useState<Flight | null>(null);
  const [base, setBase] = React.useState(emptyFrame);
  const [imageSize, setImageSize] = React.useState({ width: 1, height: 1 });
  const current = React.useRef<Flight | null>(null);
  const root = React.useRef<View>(null);
  const running = React.useRef(false);
  const imageReady = React.useRef(false);
  const destination = React.useRef<ImageFrame | null>(null);
  const source = useSharedValue(emptyFrame);
  const target = useSharedValue(emptyFrame);
  const timeline = useSharedValue(1);
  const clear = React.useCallback(() => {
    current.current = null; running.current = false; destination.current = null;
    cancelAnimation(timeline); timeline.value = 1;
    setContentReady(true); setFlight(null);
  }, [timeline]);
  React.useEffect(() => {
    if (!flight) return;
    const timeout = setTimeout(clear, 2200);
    return () => clearTimeout(timeout);
  }, [flight, clear]);
  React.useEffect(() => { if (reduced) clear(); }, [reduced, clear]);
  const showContent = React.useCallback(() => { if (current.current) setContentReady(true); }, []);
  useAnimatedReaction(() => timeline.value >= plantEntrance.contentStart, (ready, previous) => {
    if (ready && previous === false) runOnJS(showContent)();
  }, [showContent]);
  const launch = React.useCallback(() => {
    if (!current.current || !imageReady.current || !destination.current || running.current) return;
    running.current = true;
    target.value = destination.current;
    setBase(destination.current);
  }, [target]);
  // Commit the fixed destination viewport once; frames animate transforms only.
  React.useLayoutEffect(() => {
    if (!running.current || !flight) return;
    timeline.value = withTiming(1, { duration: PLANT_ENTRANCE_MS, easing: Easing.linear }, done => { if (done) runOnJS(clear)(); });
  }, [base, flight, timeline, clear]);
  const start = React.useCallback((id: string, uri: string, frame: ImageFrame) => {
    if (reduced || current.current) return;
    const next = { id, uri, frame };
    current.current = next; destination.current = null; imageReady.current = false; running.current = false;
    cancelAnimation(timeline);
    source.value = frame; target.value = frame; timeline.value = 0;
    setBase(frame); setImageSize({ width: frame.width, height: frame.height });
    setContentReady(false); setFlight(next);
  }, [reduced, source, target, timeline]);
  const arrive = React.useCallback((id: string, frame: ImageFrame) => {
    const pending = current.current;
    if (!pending || pending.id !== id || destination.current) return;
    root.current?.measureInWindow((x, y) => {
      if (current.current !== pending) return;
      source.value = { ...pending.frame, x: pending.frame.x - x, y: pending.frame.y - y };
      destination.current = { ...frame, x: frame.x - x, y: frame.y - y };
      launch();
    });
  }, [source, launch]);
  const photoStyle = useAnimatedStyle(() => {
    const p = photoProgress(timeline.value);
    const geometry = coverTransform(source.value, target.value, imageSize, p);
    return {
      transform: [{ translateX: geometry.translateX }, { translateY: geometry.translateY }, { scaleX: geometry.scaleX }, { scaleY: geometry.scaleY }],
      borderTopLeftRadius: 13 + 11 * p, borderTopRightRadius: 13 + 11 * p,
      borderBottomLeftRadius: 13 * (1 - p), borderBottomRightRadius: 13 * (1 - p),
      opacity: 1 - entrancePhase(timeline.value, plantEntrance.handoffStart, plantEntrance.handoffEnd),
    };
  });
  const imageStyle = useAnimatedStyle(() => {
    const geometry = coverTransform(source.value, target.value, imageSize, photoProgress(timeline.value));
    return { transform: [{ scaleX: geometry.imageScaleX }, { scaleY: geometry.imageScaleY }] };
  });
  const fadeStyle = useAnimatedStyle(() => ({ opacity: entrancePhase(timeline.value, 0.22, 0.68) }));
  const context = React.useMemo(() => ({ active: !!flight, contentReady, previewUri: flight?.uri || '', timeline, start, arrive }), [flight, contentReady, timeline, start, arrive]);
  return <Context.Provider value={context}><View ref={root} collapsable={false} style={{ flex: 1, backgroundColor: theme.background }}>{children}
    {flight && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}><Reanimated.View testID="plant-photo-flight" style={[{ position: 'absolute', left: 0, top: 0, width: base.width, height: base.height, overflow: 'hidden' }, photoStyle]}><Reanimated.Image source={{ uri: flight.uri }} onLoad={() => {
      const pending = current.current;
      if (!pending || imageReady.current) return;
      Image.getSize(pending.uri, (width, height) => {
        if (current.current !== pending || imageReady.current) return;
        setImageSize({ width, height }); imageReady.current = true; launch();
      }, clear);
    }} onError={clear} resizeMode="stretch" style={[{ position: 'absolute', left: (base.width - imageSize.width) / 2, top: (base.height - imageSize.height) / 2, width: imageSize.width, height: imageSize.height }, imageStyle]} /><Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fadeStyle]}><PlantCoverFade surface={theme.surface} /></Reanimated.View></Reanimated.View></View>}
  </View></Context.Provider>;
}

/** Scene chrome overlaps the settling photo; interaction unlocks at completion. */
export function usePlantSceneEntrance() {
  const { active, timeline } = usePlantImageTransition();
  return useAnimatedStyle(() => ({ opacity: active ? entrancePhase(timeline.value, plantEntrance.chromeStart, plantEntrance.chromeEnd) : 1 }));
}
