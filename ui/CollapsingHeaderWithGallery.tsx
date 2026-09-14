import React from 'react';
import { View, Image } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolate, type SharedValue } from 'react-native-reanimated';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';

interface CollapsingHeaderWithGalleryProps {
  plantId: string;
  plantImageUri?: string;
  scrollY: SharedValue<number>;
  children?: React.ReactNode;
}

const HEADER_MAX_HEIGHT = 220;
const HEADER_MIN_HEIGHT = 100;

export default function CollapsingHeaderWithGallery({
  plantId: _plantId,
  plantImageUri,
  scrollY,
  children,
}: CollapsingHeaderWithGalleryProps) {
  const renderableImageUri = getRenderablePlantImageUri(plantImageUri);
  const animatedBgImageStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT],
      [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
      Extrapolate.CLAMP
    );
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      width: '100%',
      height,
      zIndex: 0,
    };
  });

  return (
    <View style={{ flex: 1 }}>
      <Animated.View style={animatedBgImageStyle}>
        {renderableImageUri ? (
          <Image source={{ uri: renderableImageUri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
        ) : (
          <View style={{ width: '100%', height: '100%', backgroundColor: '#e5e7eb' }} />
        )}
      </Animated.View>
      <View style={{ flex: 1, paddingTop: HEADER_MAX_HEIGHT, zIndex: 1 }}>
        {children}
      </View>
    </View>
  );
}
