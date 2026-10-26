import React, { useState, useEffect } from 'react';
import DropDownPicker from 'react-native-dropdown-picker';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, Container, useTheme } from '@/design-system';
import { Spacing, BorderRadius } from '@/design-system/tokens';
import { RipplePulse } from './RipplePulse';

interface WeedGrowDropdownInputProps {
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  value: string;
  label: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  placeholder?: string;
  zIndex?: number;
}

export function WeedGrowDropdownInput({
  icon,
  value,
  label,
  options,
  onSelect,
  placeholder,
  zIndex = 1000,
}: WeedGrowDropdownInputProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(options);
  const [showRipple, setShowRipple] = useState(false);

  useEffect(() => {
    setItems(options);
  }, [options]);

  // Show ripple when opening dropdown
  const handleSetOpen = (action: React.SetStateAction<boolean>) => {
    const val = typeof action === 'function' ? action(open) : action;
    if (val && !open) {
      setShowRipple(true);
    }
    setOpen(val);
  };

  return (
    <View style={{ zIndex, marginBottom: Spacing.md, position: 'relative' }}>
      {/* Keep the decorative ripple clear of pointer interactions. */}
      <View style={{ position: 'absolute', left: 32, top: 54, zIndex: 9999, pointerEvents: 'none' }}>
        <RipplePulse show={showRipple} color="rgba(255,0,0,0.4)" size={200} onAnimationEnd={() => setShowRipple(false)} />
      </View>
      <Container direction="row" align="center" style={{ marginBottom: Spacing.xs }}>
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={theme.colors.text.primary}
            style={{ marginRight: Spacing.xs }}
          />
        )}
        <Text variant="label" color="primary">{label}</Text>
      </Container>
      <DropDownPicker<string>
        open={open}
        value={value}
        items={items}
        setOpen={handleSetOpen}
        setValue={(action) => { const next = typeof action === 'function' ? action(value) : action; if (next !== null) onSelect(next); }}
        setItems={setItems}
        placeholder={placeholder}
        style={[
          styles.dropdown,
          {
            backgroundColor: theme.colors.background.secondary,
            borderColor: theme.colors.border.primary,
          }
        ]}
        textStyle={{
          color: theme.colors.text.primary,
          fontSize: 16,
        }}
        dropDownContainerStyle={[
          styles.dropdownContainer,
          {
            backgroundColor: theme.colors.background.secondary,
            borderColor: theme.colors.border.primary,
          }
        ]}
        listItemLabelStyle={{
          color: theme.colors.text.primary,
        }}
        ArrowDownIconComponent={({ style }) => (
          <View style={style}>
          <MaterialCommunityIcons 
            name="chevron-down" 
            size={20} 
            color={theme.colors.text.secondary} 
          /></View>
        )}
        listMode="SCROLLVIEW"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dropdown: {
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
  },
  dropdownContainer: {
    borderRadius: BorderRadius.md,
  },
});
