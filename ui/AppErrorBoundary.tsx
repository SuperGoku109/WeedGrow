import { gardenThemes, type GardenTheme } from '@/design-system/tokens/garden';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { reportError } from '@/lib/diagnostics/reportError';
export default class AppErrorBoundary extends React.Component<{ children: React.ReactNode; theme?: GardenTheme }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { reportError(error, 'render', true); }
  render() {
    const t = this.props.theme ?? gardenThemes.grove;
    if (!this.state.failed) return this.props.children;
    return <View style={{ flex: 1, backgroundColor: t.background, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 }}><Text accessibilityRole="header" style={{ color: t.text, fontSize: 22, fontWeight: '700' }}>Something went wrong</Text><Text style={{ color: t.muted, textAlign: 'center', lineHeight: 22 }}>We couldn’t display this screen. Try opening it again.</Text><Pressable accessibilityRole="button" accessibilityLabel="Try opening the app again" onPress={() => this.setState({ failed: false })} style={{ minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: t.accent }}><Text style={{ color: t.onAccent, fontWeight: '700' }}>Try again</Text></Pressable></View>;
  }
}
