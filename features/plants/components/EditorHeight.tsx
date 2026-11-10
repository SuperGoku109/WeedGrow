import React from 'react';
import { Keyboard, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { menuPosition, type MenuAnchor } from '@/ui/AnchoredActionMenu';
import { EditorField } from './PlantEditorFields';
import type { PlantTheme } from './plantDetailTheme';
import { HEIGHT_UNITS, displayHeight, heightInCentimetres, type HeightUnit } from '../form/heightUnits';

export default function EditorHeight({ value, onChange, disabled, theme: t }: { value: string; onChange(value: string): void; disabled: boolean; theme: PlantTheme }) {
  const [unit, setUnit] = React.useState<HeightUnit>('cm');
  const [text, setText] = React.useState(value);
  const [anchor, setAnchor] = React.useState<MenuAnchor | null>(null);
  const trigger = React.useRef<View>(null);
  const emitted = React.useRef(value);
  const measuring = React.useRef(0);
  const close = React.useCallback(() => { measuring.current++; setAnchor(null); trigger.current?.focus?.(); }, []);
  React.useEffect(() => {
    if (value !== emitted.current) { setText(displayHeight(value, unit)); emitted.current = value; }
  }, [value, unit]);
  React.useEffect(() => { if (disabled) { measuring.current++; setAnchor(null); } }, [disabled]);
  React.useEffect(() => () => { measuring.current++; }, []);
  const show = () => {
    if (disabled) return;
    Keyboard.dismiss();
    const request = ++measuring.current;
    trigger.current?.measureInWindow((x, y, width, height) => {
      if (request === measuring.current && width > 0 && height > 0) setAnchor({ x, y, width, height });
    });
  };
  return <View style={{ minWidth: 0 }}>
    <EditorField label="Height" testID="plant-editor-height" value={text} editable={!disabled} keyboardType="decimal-pad" placeholder="—" suffix={unit} onChangeText={raw => { setText(raw); const next = heightInCentimetres(raw, unit); emitted.current = next; onChange(next); }} suffixControl={
      <Pressable ref={trigger} collapsable={false} accessibilityRole="button" accessibilityLabel={'Height unit: ' + unit} accessibilityHint="Choose a different height unit." accessibilityState={{ expanded: !!anchor, disabled }} disabled={disabled} hitSlop={4} onPress={show} style={({ pressed }) => ({ minHeight: 40, minWidth: 52, margin: 4, paddingHorizontal: 8, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, backgroundColor: t.elevated, opacity: pressed ? .75 : 1 })}>
        <Text style={{ color: t.accent, fontSize: 12, fontWeight: '600' }}>{unit}</Text><Feather name={anchor ? 'chevron-up' : 'chevron-down'} size={12} color={t.muted} />
      </Pressable>
    } />
    {anchor && <HeightUnitMenu anchor={anchor} unit={unit} theme={t} onClose={close} onSelect={next => { setText(displayHeight(value, next)); setUnit(next); close(); }} />}
  </View>;
}
function HeightUnitMenu({ anchor, unit, theme: t, onClose, onSelect }: { anchor: MenuAnchor; unit: HeightUnit; theme: PlantTheme; onClose(): void; onSelect(unit: HeightUnit): void }) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dimensions = React.useRef({ width, height, fontScale });
  React.useEffect(() => {
    if (dimensions.current.width !== width || dimensions.current.height !== height || dimensions.current.fontScale !== fontScale) onClose();
  }, [width, height, fontScale, onClose]);
  const position = menuPosition(anchor, width, height, 8 + HEIGHT_UNITS.length * 44 * Math.max(1, fontScale), insets.top, insets.bottom, Math.min(240, 160 * Math.max(1, fontScale)));
  return <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <View style={{ flex: 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss height units" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View accessibilityViewIsModal onAccessibilityEscape={onClose} style={{ position: 'absolute', left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight, borderWidth: 1, borderColor: t.border, borderRadius: 12, backgroundColor: t.surface, boxShadow: '0px 6px 22px rgba(0,0,0,0.24)', overflow: 'hidden' }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View accessibilityRole="radiogroup" accessibilityLabel="Height units" style={{ padding: 4 }}>
          {HEIGHT_UNITS.map(option => <Pressable key={option.unit} accessibilityRole="radio" accessibilityLabel={option.name + ' (' + option.unit + ')'} aria-checked={unit === option.unit} accessibilityState={{ checked: unit === option.unit }} onPress={() => onSelect(option.unit)} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: unit === option.unit ? t.elevated : 'transparent', opacity: pressed ? .7 : 1 })}>
            <Text style={{ color: unit === option.unit ? t.accent : t.text, fontSize: 13, flex: 1 }}>{option.name}</Text><Text style={{ color: t.muted, fontSize: 11 }}>{option.unit}</Text>
          </Pressable>)}
        </View></ScrollView>
      </View>
    </View>
  </Modal>;
}
