import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { reportError } from '@/lib/diagnostics/reportError';
export default class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { reportError(error, 'render', true); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={{ flex: 1, backgroundColor: '#14241b', padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 }}><Text accessibilityRole="header" style={{ color: '#edf0e3', fontSize: 22, fontWeight: '700' }}>Something went wrong</Text><Text style={{ color: '#b4c4ad', textAlign: 'center', lineHeight: 22 }}>We couldn’t display this screen. Try opening it again.</Text><Pressable accessibilityRole="button" accessibilityLabel="Try opening the app again" onPress={() => this.setState({ failed: false })} style={{ minHeight: 48, padding: 14, borderRadius: 12, backgroundColor: '#c8e78b' }}><Text style={{ color: '#243420', fontWeight: '700' }}>Try again</Text></Pressable></View>;
  }
}
