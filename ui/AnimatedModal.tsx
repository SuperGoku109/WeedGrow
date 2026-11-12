import React from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { growMotion } from '@/design-system/tokens/motion';
import { useReducedMotion } from './GrowMotion';

/** Guarded editors decide whether closing is allowed before their presentation changes. */
export default function AnimatedModal({ onClose, disabled = false, placement = 'sheet', deferClose = false, children }: {
  onClose(): void; disabled?: boolean; placement?: 'sheet' | 'center'; deferClose?: boolean; children(close: () => void, closing: boolean): React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const value = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const scrim = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const animation = React.useRef<Animated.CompositeAnimation | null>(null);
  const closeLock = React.useRef(false);
  const [closing, setClosing] = React.useState(false);
  const onClosed = React.useRef(onClose);
  const completed = React.useRef(false);
  onClosed.current = onClose;
  const finishClose = React.useCallback(() => { if (!completed.current) { completed.current = true; onClosed.current(); } }, []);
  React.useEffect(() => {
    if (closeLock.current) return;
    if (reduced) { value.setValue(1); scrim.setValue(1); return; }
    animation.current = Animated.parallel([
      Animated.spring(value, { toValue: 1, ...growMotion.selectionSpring, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(scrim, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
    ]);
    animation.current.start();
    return () => animation.current?.stop();
  }, [reduced, value, scrim]);
  React.useEffect(() => {
    if (closing && reduced) { animation.current?.stop(); finishClose(); }
  }, [closing, reduced, finishClose]);
  React.useEffect(() => () => animation.current?.stop(), []);
  const close = () => {
    if (closeLock.current) return;
    // Draft guards and asynchronous draft persistence can decline a sheet close.
    if (!deferClose) { onClosed.current(); return; }
    closeLock.current = true;
    Keyboard.dismiss();
    if (reduced) { finishClose(); return; }
    setClosing(true);
    animation.current?.stop();
    animation.current = Animated.parallel([
      Animated.timing(value, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(scrim, { toValue: 0, duration: 180, useNativeDriver: Platform.OS !== 'web' }),
    ]);
    animation.current.start(({ finished }) => { if (finished) finishClose(); });
  };
  return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => { if (!disabled) close(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, alignItems: 'center', justifyContent: placement === 'sheet' ? 'flex-end' : 'center', paddingHorizontal: placement === 'sheet' ? 0 : 20, paddingTop: Math.max(insets.top, 16), paddingBottom: placement === 'sheet' ? 0 : Math.max(insets.bottom, 16) }}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#07130d', opacity: scrim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.68], extrapolate: 'clamp' }) }]} />
      <Animated.View pointerEvents={closing ? 'none' : 'auto'} accessibilityViewIsModal accessibilityElementsHidden={closing} aria-hidden={closing} style={{ width: '100%', maxWidth: placement === 'sheet' ? 620 : 460, maxHeight: '100%', flexShrink: 1, opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [placement === 'sheet' ? 48 : 12, 0] }) }, { scale: placement === 'sheet' ? 1 : value.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }}>
        {children(close, closing)}
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}
