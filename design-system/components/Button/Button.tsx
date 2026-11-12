// design-system/components/Button/Button.tsx
/**
 * Enhanced Button Component with Design System Integration
 * Provides consistent button styles and variants
 */

import { gardenControls } from '@/design-system/tokens/garden';
import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ActivityIndicator,
} from 'react-native';
import { Text } from '../Text/Text';
import { ColorTokens, Spacing, Shadows } from '../../tokens';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
  style?: any;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  iconPosition = 'left',
  disabled,
  children,
  style,
  ...props
}) => {
  const buttonStyle = React.useMemo(() => {
    const baseStyle: any = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: gardenControls.radius,
      ...Shadows.button,
    };

    // Size variations
    switch (size) {
      case 'sm':
        baseStyle.paddingVertical = gardenControls.paddingVertical;
        baseStyle.paddingHorizontal = Spacing.md;
        baseStyle.minHeight = gardenControls.height;
        break;
      case 'lg':
        baseStyle.paddingVertical = 10;
        baseStyle.paddingHorizontal = Spacing.xl;
        baseStyle.minHeight = gardenControls.fieldHeight;
        break;
      default: // md
        baseStyle.paddingVertical = gardenControls.paddingVertical;
        baseStyle.paddingHorizontal = gardenControls.paddingHorizontal;
        baseStyle.minHeight = gardenControls.height;
        break;
    }

    // Variant styles
    switch (variant) {
      case 'primary':
        baseStyle.backgroundColor = ColorTokens.brand.primary;
        break;
      case 'secondary':
        baseStyle.backgroundColor = ColorTokens.brand.secondary;
        break;
      case 'outline':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.borderWidth = 1;
        baseStyle.borderColor = ColorTokens.brand.primary;
        break;
      case 'ghost':
        baseStyle.backgroundColor = 'transparent';
        baseStyle.shadowOpacity = 0;
        baseStyle.elevation = 0;
        break;
      case 'danger':
        baseStyle.backgroundColor = ColorTokens.status.error;
        break;
    }

    // Full width
    if (fullWidth) {
      baseStyle.width = '100%';
    }

    // Disabled state
    if (disabled || loading) {
      baseStyle.opacity = 0.6;
    }

    return [baseStyle, style];
  }, [variant, size, fullWidth, disabled, loading, style]);

  const textColor = React.useMemo(() => {
    if (variant === 'outline' || variant === 'ghost') {
      return ColorTokens.brand.primary;
    }
    return ColorTokens.text.primary;
  }, [variant]);

  const iconSize = React.useMemo(() => {
    switch (size) {
      case 'sm':
        return 16;
      case 'lg':
        return 20;
      default:
        return gardenControls.iconSize;
    }
  }, [size]);

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator color={textColor} size="small" />;
    }

    const textElement = (
      <Text
        variant="button"
        style={{ color: textColor, fontSize: size === 'lg' ? 14 : gardenControls.labelSize }}
      >
        {children}
      </Text>
    );

    if (icon) {
      const iconElement = (
        <MaterialCommunityIcons
          name={icon}
          size={iconSize}
          color={textColor}
          style={{ marginHorizontal: Spacing.xs }}
        />
      );

      return iconPosition === 'left' ? (
        <>
          {iconElement}
          {textElement}
        </>
      ) : (
        <>
          {textElement}
          {iconElement}
        </>
      );
    }

    return textElement;
  };

  return (
    <TouchableOpacity
      hitSlop={gardenControls.hitSlop}
      style={buttonStyle}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};
