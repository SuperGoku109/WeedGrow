import { useTheme } from '@/design-system/utils/useTheme';
// design-system/components/Input/Input.tsx
/**
 * Enhanced Input Component with Design System Integration
 * Provides consistent input styling and behavior
 */

import { gardenControls } from '@/design-system/tokens/garden';
import React, { forwardRef } from 'react';
import {
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { Text } from '../Text/Text';
import { Spacing, BorderRadius, Typography } from '../../tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  variant?: 'outlined' | 'filled';
  fullWidth?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  helper,
  icon,
  iconPosition = 'left',
  variant = 'outlined',
  fullWidth = true,
  style,
  ...props
}, ref) => {
  const { colors } = useTheme();
  const [isFocused, setIsFocused] = React.useState(false);

  const containerStyle = React.useMemo(() => {
    const baseStyle: any = {
      marginBottom: Spacing.md,
    };

    if (fullWidth) {
      baseStyle.width = '100%';
    }

    return baseStyle;
  }, [fullWidth]);

  const inputContainerStyle = React.useMemo(() => {
    const baseStyle: any = {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: BorderRadius.input,
      paddingHorizontal: Spacing.inputPadding.horizontal,
      paddingVertical: 10,
      minHeight: gardenControls.fieldHeight,
    };

    if (variant === 'outlined') {
      baseStyle.borderWidth = 1;
      baseStyle.borderColor = error
        ? colors.status.error
        : isFocused
        ? colors.brand.primary
        : colors.border.primary;
      baseStyle.backgroundColor = colors.background.primary;
    } else {
      baseStyle.backgroundColor = colors.background.secondary;
    }

    return baseStyle;
  }, [variant, error, isFocused, colors]);

  const inputStyle = React.useMemo(() => {
    return [
      {
        flex: 1,
        fontSize: Typography.sizes.base,
        color: colors.text.primary,
        padding: 0, // Remove default padding
      },
      style,
    ];
  }, [style, colors]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    props.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    props.onBlur?.(e);
  };

  return (
    <View style={containerStyle}>
      {label && (
        <Text
          variant="label"
          color={error ? 'primary' : 'secondary'}
          style={{
            marginBottom: Spacing.xs,
            color: error ? colors.status.error : colors.text.secondary,
          }}
        >
          {label}
        </Text>
      )}
      
      <View style={inputContainerStyle}>
        {icon && iconPosition === 'left' && (
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={error ? colors.status.error : colors.text.secondary}
            style={{ marginRight: Spacing.sm }}
          />
        )}
        
        <TextInput
          ref={ref}
          style={inputStyle}
          placeholderTextColor={colors.text.tertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
        
        {icon && iconPosition === 'right' && (
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={error ? colors.status.error : colors.text.secondary}
            style={{ marginLeft: Spacing.sm }}
          />
        )}
      </View>
      
      {(error || helper) && (
        <Text
          variant="caption"
          color={error ? 'primary' : 'secondary'}
          style={{
            marginTop: Spacing.xs,
            color: error ? colors.status.error : colors.text.secondary,
          }}
        >
          {error || helper}
        </Text>
      )}
    </View>
  );
});

Input.displayName = 'Input';
