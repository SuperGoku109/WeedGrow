import React from 'react';
import { ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { Card } from '@/design-system/components';
import { useColorScheme } from '@/hooks/useColorScheme';
import { ColorTokens } from '@/design-system/tokens';

interface WeedGrowCardProps extends ViewProps {
  children: React.ReactNode;
}

export function WeedGrowCard({ children, style, entering, ...rest }: WeedGrowCardProps & { entering?: React.ComponentProps<typeof Animated.View>['entering'] }) {
  const theme = (useColorScheme() ?? 'dark') as 'light' | 'dark';
  
  const backgroundColor = theme === 'dark' 
    ? ColorTokens.background.secondary 
    : ColorTokens.gray[100];
  
  const borderColor = theme === 'dark' 
    ? ColorTokens.border.primary 
    : ColorTokens.border.secondary;

  return (
    <Animated.View entering={entering} {...rest}>
      <Card
        style={[
          {
            backgroundColor,
            borderColor,
            borderWidth: 1,
            alignItems: 'center',
            width: '100%',
            alignSelf: 'center',
            maxWidth: 480,
          },
          style,
        ]}
      >
        {children}
      </Card>
    </Animated.View>
  );
}
