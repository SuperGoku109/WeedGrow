import React from 'react';
import { Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { menuPosition, type MenuAnchor } from './AnchoredActionMenu';
import type { GardenTheme } from '@/design-system/tokens/garden';

export default function AnchoredSelectMenu({ anchor, label, value, options, onClose, onSelect, theme: t }: {
  anchor: MenuAnchor; label: string; value: string; options: readonly { label: string; value: string }[];
  onClose(): void; onSelect(value: string): void; theme: GardenTheme;
}) {
  const [search, setSearch] = React.useState('');
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dimensions = React.useRef({ width, fontScale });
  React.useEffect(() => {
    if (dimensions.current.width !== width || dimensions.current.fontScale !== fontScale) onClose();
  }, [width, fontScale, onClose]);
  const searchable = options.length > 7;
  const shown = options.filter(option => option.label.toLowerCase().includes(search.trim().toLowerCase()));
  const wantedHeight = Math.min(360 * Math.max(1, fontScale), Math.max(56, 8 + options.length * 48 * Math.max(1, fontScale) + (searchable ? 64 : 0)));
  const position = menuPosition(anchor, width, height, wantedHeight, insets.top, insets.bottom, Math.min(360, Math.max(anchor.width, 220) * Math.max(1, fontScale)));
  const visibleHeight = Math.min(position.maxHeight, 360 * Math.max(1, fontScale), Math.max(56, 8 + Math.max(1, shown.length) * 48 * Math.max(1, fontScale) + (searchable ? 64 : 0)));
  const menuTop = position.top + (position.opensBelow ? 0 : Math.min(wantedHeight, position.maxHeight) - visibleHeight);
  const dismiss = () => { Keyboard.dismiss(); onClose(); };
  return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={dismiss}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Dismiss ' + label.toLowerCase() + ' options'} onPress={dismiss} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View accessibilityViewIsModal onAccessibilityEscape={dismiss} style={{ position: 'absolute', left: position.left, top: menuTop, width: position.width, height: visibleHeight, borderWidth: 1, borderColor: t.border, borderRadius: 12, backgroundColor: t.surface, boxShadow: '0px 6px 22px rgba(0,0,0,0.24)', overflow: 'hidden' }}>
        {searchable && <TextInput accessibilityLabel={'Search ' + label.toLowerCase()} value={search} onChangeText={setSearch} placeholder="Search options…" placeholderTextColor={t.muted} style={{ margin: 8, paddingHorizontal: 12, minHeight: 48, borderRadius: 8, backgroundColor: t.elevated, color: t.text, fontSize: 16 }} />}
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }}><View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ padding: 4 }}>
          {shown.map(option => <Pressable key={option.value} accessibilityRole="radio" aria-checked={value === option.value} accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value }} onPress={() => { dismiss(); onSelect(option.value); }} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, backgroundColor: value === option.value ? t.elevated : 'transparent', opacity: pressed ? .7 : 1 })}>
            <Text style={{ flex: 1, color: value === option.value ? t.accent : t.text, fontSize: 14, lineHeight: 21 }}>{option.label}</Text>{value === option.value && <Feather name="check" size={16} color={t.accent} />}
          </Pressable>)}
          {!shown.length && <Text style={{ color: t.muted, fontSize: 14, padding: 12 }}>No matching options.</Text>}
        </View></ScrollView>
      </View>
    </View>
  </Modal>;
}
