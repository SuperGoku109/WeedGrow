import { useTheme } from '@/design-system/utils/useTheme';
// design-system/components/Container/Container.tsx
/**
 * Enhanced Container Component with Design System Integration
 * Provides consistent spacing and layout patterns
 */

import React from 'react';
import { View, ViewProps } from 'react-native';
import { Spacing, BorderRadius, Shadows } from '../../tokens';

export interface ContainerProps extends ViewProps {
  variant?: 'default' | 'card' | 'surface' | 'modal';
  padding?: keyof typeof Spacing | number;
  margin?: keyof typeof Spacing | number;
  gap?: keyof typeof Spacing | number;
  direction?: 'row' | 'column';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  shadow?: keyof typeof Shadows;
  radius?: keyof typeof BorderRadius;
  backgroundColor?: string;
}

export const Container: React.FC<ContainerProps> = ({
  variant = 'default',
  padding,
  margin,
  gap,
  direction = 'column',
  align,
  justify,
  shadow,
  radius,
  backgroundColor,
  style,
  children,
  ...props
}) => {
  const { colors } = useTheme();
  const containerStyle = React.useMemo(() => {
    const baseStyle: any = {
      flexDirection: direction,
      ...(align && { alignItems: align }),
      ...(justify && { justifyContent: justify }),
    };

    // Apply variant-specific styles
    switch (variant) {
      case 'card':
        baseStyle.backgroundColor = backgroundColor || colors.background.card;
        baseStyle.borderRadius = BorderRadius.card;
        baseStyle.padding = Spacing.cardPadding;
        Object.assign(baseStyle, Shadows.card);
        break;
      case 'surface':
        baseStyle.backgroundColor = backgroundColor || colors.background.surface;
        baseStyle.borderRadius = BorderRadius.md;
        baseStyle.padding = Spacing.md;
        break;
      case 'modal':
        baseStyle.backgroundColor = backgroundColor || colors.background.card;
        baseStyle.borderRadius = BorderRadius.modal;
        baseStyle.padding = Spacing.lg;
        Object.assign(baseStyle, Shadows.modal);
        break;
      default:
        if (backgroundColor) {
          baseStyle.backgroundColor = backgroundColor;
        }
        break;
    }

    // Apply custom spacing
    if (padding !== undefined) {
      baseStyle.padding = typeof padding === 'number' ? padding : Spacing[padding];
    }
    if (margin !== undefined) {
      baseStyle.margin = typeof margin === 'number' ? margin : Spacing[margin];
    }
    if (gap !== undefined) {
      baseStyle.gap = typeof gap === 'number' ? gap : Spacing[gap];
    }

    // Apply custom radius
    if (radius !== undefined) {
      baseStyle.borderRadius = BorderRadius[radius];
    }

    // Apply custom shadow
    if (shadow !== undefined) {
      Object.assign(baseStyle, Shadows[shadow]);
    }

    return [baseStyle, style];
  }, [
    variant,
    padding,
    margin,
    gap,
    direction,
    align,
    justify,
    shadow,
    radius,
    backgroundColor,
    style,
  , colors]);

  return (
    <View style={containerStyle} {...props}>
      {children}
    </View>
  );
};

// Predefined container variants
export const Card: React.FC<Omit<ContainerProps, 'variant'>> = (props) => (
  <Container variant="card" {...props} />
);

export const Surface: React.FC<Omit<ContainerProps, 'variant'>> = (props) => (
  <Container variant="surface" {...props} />
);

export const Modal: React.FC<Omit<ContainerProps, 'variant'>> = (props) => (
  <Container variant="modal" {...props} />
);

export const Row: React.FC<ContainerProps> = (props) => (
  <Container direction="row" align="center" {...props} />
);

export const Column: React.FC<ContainerProps> = (props) => (
  <Container direction="column" {...props} />
);
