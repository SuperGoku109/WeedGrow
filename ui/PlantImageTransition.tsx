import React from 'react';
import PlantCoverFade from './PlantCoverFade';
import { Image, Platform, StyleSheet, View, type ImageLoadEventData, type NativeSyntheticEvent } from 'react-native';
import Reanimated, { cancelAnimation, Easing, makeMutable, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { coverTransform, entrancePhase, photoProgress, PLANT_ENTRANCE_MS, plantEntrance, type ImageFrame } from './plantEntrance';

type Flight = { id: string; uri: string; frame: ImageFrame; navigate?: () => void };
const emptyFrame: ImageFrame = { x: 0, y: 0, width: 1, height: 1 };
const idleTimeline = makeMutable(1);
const Context = React.createContext({ active: false, preparing: false, contentReady: true, plantId: '', previewUri: '', timeline: idleTimeline as SharedValue<number>, start: (_id: string, _uri: string, _frame: ImageFrame, navigate?: () => void) => { navigate?.(); }, arrive: (_id: string, _frame: ImageFrame) => {} });
export const usePlantImageTransition = () => React.useContext(Context);

/** One UI-thread clock owns photo travel, crop, treatment, chrome and handoff. */
export default function PlantImageTransitionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const theme = useAppTheme();
  const [contentReady, setContentReady] = React.useState(true);
  const [flight, setFlight] = React.useState<Flight | null>(null);
  const [preparing, setPreparing] = React.useState(false);
  const [readyToAnimate, setReadyToAnimate] = React.useState(false);
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
    const navigate = current.current?.navigate;
    current.current = null; running.current = false; destination.current = null;
    cancelAnimation(timeline); timeline.value = 1;
    setPreparing(false); setReadyToAnimate(false); setContentReady(true); setFlight(null);
    navigate?.();
  }, [timeline]);
  React.useEffect(() => {
    if (!flight) return;
    const timeout = setTimeout(clear, preparing ? 500 : 2200);
    return () => clearTimeout(timeout);
  }, [flight, preparing, clear]);
  React.useEffect(() => { if (reduced) clear(); }, [reduced, clear]);
  const showContent = React.useCallback(() => { if (current.current) setContentReady(true); }, []);
  useAnimatedReaction(() => timeline.value >= plantEntrance.contentStart, (ready, previous) => {
    if (ready && previous === false) runOnJS(showContent)();
  }, [showContent]);
  const android = Platform.OS === 'android';
  const launch = React.useCallback(() => {
    if (!current.current || !imageReady.current || !destination.current || running.current) return;
    running.current = true;
    target.value = destination.current;
    // Android retains the measured source layout so the next native commit
    // cannot briefly combine the new layout size with the old transform.
    if (!android) setBase(destination.current);
    setReadyToAnimate(true);
  }, [android, target]);
  React.useLayoutEffect(() => {
    if (!readyToAnimate || !running.current || !flight) return;
    timeline.value = withTiming(1, { duration: PLANT_ENTRANCE_MS, easing: Easing.linear }, done => { if (done) runOnJS(clear)(); });
  }, [readyToAnimate, flight, timeline, clear]);
  const start = React.useCallback((id: string, uri: string, frame: ImageFrame, navigate?: () => void) => {
    if (current.current) return;
    if (reduced) { navigate?.(); return; }
    const next = { id, uri, frame, navigate };
    current.current = next; destination.current = null; imageReady.current = false; running.current = false;
    cancelAnimation(timeline);
    source.value = frame; target.value = frame; timeline.value = 0;
    setBase(frame); setImageSize({ width: frame.width, height: frame.height });
    setPreparing(!!navigate); setContentReady(false); setFlight(next);
  }, [reduced, source, target, timeline]);
  const prepareNavigation = React.useCallback((pending: Flight) => {
    if (!pending.navigate) return;
    root.current?.measureInWindow((x, y) => {
      if (current.current !== pending) return;
      const frame = { ...pending.frame, x: pending.frame.x - x, y: pending.frame.y - y };
      source.value = frame;
      target.value = frame;
      requestAnimationFrame(() => {
        if (current.current !== pending || !pending.navigate) return;
        const navigate = pending.navigate;
        pending.navigate = undefined;
        setPreparing(false);
        navigate();
      });
    });
  }, [source, target]);
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
    const geometry = coverTransform(source.value, target.value, imageSize, p, android ? source.value : target.value);
    return {
      transform: [{ translateX: geometry.translateX }, { translateY: geometry.translateY }, { scaleX: geometry.scaleX }, { scaleY: geometry.scaleY }],
      borderTopLeftRadius: 13 + 11 * p, borderTopRightRadius: 13 + 11 * p,
      borderBottomLeftRadius: 13 * (1 - p), borderBottomRightRadius: 13 * (1 - p),
      opacity: 1 - entrancePhase(timeline.value, plantEntrance.handoffStart, plantEntrance.handoffEnd),
    };
  });
  const imageStyle = useAnimatedStyle(() => {
    const geometry = coverTransform(source.value, target.value, imageSize, photoProgress(timeline.value), android ? source.value : target.value);
    return { transform: [{ scaleX: geometry.imageScaleX }, { scaleY: geometry.imageScaleY }] };
  });
  const fadeStyle = useAnimatedStyle(() => ({ opacity: entrancePhase(timeline.value, 0.22, 0.68) }));
  const context = React.useMemo(() => ({ active: !!flight, preparing, contentReady, plantId: flight?.id || '', previewUri: flight?.uri || '', timeline, start, arrive }), [flight, preparing, contentReady, timeline, start, arrive]);
  const overlayFailed = () => { if (current.current === flight) clear(); };
  const overlayLoaded = (event: NativeSyntheticEvent<ImageLoadEventData>) => {
    if (!flight || current.current !== flight || imageReady.current) return;
    const ready = (width: number, height: number) => {
      if (current.current !== flight || imageReady.current) return;
      if (!(width > 0 && height > 0)) { clear(); return; }
      setImageSize({ width, height });
      imageReady.current = true;
      prepareNavigation(flight);
      launch();
    };
    const size = flight.navigate ? event.nativeEvent.source : undefined;
    if (size && size.width > 0 && size.height > 0) ready(size.width, size.height);
    else Image.getSize(flight.uri, ready, overlayFailed);
  };
  return <Context.Provider value={context}>
    <View ref={root} collapsable={false} style={{ flex: 1, backgroundColor: theme.background }}>
      {children}
      {flight && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { zIndex: 1, opacity: preparing ? 0 : 1 }]}>
        <Reanimated.View testID="plant-photo-flight" style={[{ position: 'absolute', left: 0, top: 0, width: base.width, height: base.height, overflow: 'hidden' }, photoStyle]}>
          <Reanimated.Image source={{ uri: flight.uri }} onLoad={overlayLoaded} onError={overlayFailed} resizeMode="stretch" fadeDuration={0}
            style={[{ position: 'absolute', left: (base.width - imageSize.width) / 2, top: (base.height - imageSize.height) / 2, width: imageSize.width, height: imageSize.height }, imageStyle]} />
          <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fadeStyle]}>
            <PlantCoverFade surface={theme.surface} />
          </Reanimated.View>
        </Reanimated.View>
      </View>}
    </View>
  </Context.Provider>;
}

/** Scene chrome overlaps the settling photo; interaction unlocks at completion. */
export function usePlantSceneEntrance() {
  const { active, preparing, timeline } = usePlantImageTransition();
  return useAnimatedStyle(() => ({ opacity: active && !preparing ? entrancePhase(timeline.value, plantEntrance.chromeStart, plantEntrance.chromeEnd) : 1 }));
}
