import React from 'react';
import { View, ImageBackground, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ThemedText } from '@/ui/ThemedText';
import Animated, { useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';
import { usePhotoUri } from '@/ui/PlantImage';

interface PlantHeaderProps {
  imageUri?: string;
  height: number;
  name: string;
  strain?: string;
  stage?: string;
  onEdit?: () => void;
  collapseProgress?: SharedValue<number>;
  topInset?: number;
}

function formatStage(stage?: string) {
  if (!stage) return '';
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export default function PlantHeader({
  imageUri,
  height,
  name,
  strain,
  stage,
  onEdit,
  collapseProgress,
  topInset = 0,
}: PlantHeaderProps) {
  const progress = collapseProgress ?? ({ value: 0 } as SharedValue<number>);
  const { uri: renderableImageUri } = usePhotoUri(getRenderablePlantImageUri(imageUri), true);
  const AnimatedImageBackground = React.useMemo(
    () => Animated.createAnimatedComponent(ImageBackground),
    []
  );

  const fullOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.6, 1], [1, 1, 0]);
    return {
      opacity,
      transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -12]) }],
    };
  });

  const compactOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.6, 1], [0, 0, 1]);
    return {
      opacity,
      transform: [{ translateY: interpolate(progress.value, [0, 1], [12, 0]) }],
    };
  });

  const imageFadeStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.7, 1], [1, 0.25, 0], Extrapolate.CLAMP);
    return { opacity };
  });

  const infoRow = (compact: boolean) => (
    <View style={[styles.infoRow, compact && styles.infoRowCompact]}>
      {strain ? (
        <ThemedText style={[styles.strain, compact && styles.strainCompact]}>{strain}</ThemedText>
      ) : null}
      {stage ? (
        <View style={[styles.stagePill, compact && styles.stagePillCompact]}>
          <ThemedText style={[styles.stageText, compact && styles.stageTextCompact]}>
            {formatStage(stage)}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  const renderEditButton = (compact: boolean) => (
    onEdit ? (
      <TouchableOpacity
        style={[styles.editButton, compact && styles.editButtonCompact]}
        onPress={onEdit}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="note-edit-outline" size={compact ? 14 : 16} color="#ffffff" />
        <ThemedText style={[styles.editButtonText, compact && styles.editButtonTextCompact]}>
          Edit Plant
        </ThemedText>
      </TouchableOpacity>
    ) : null
  );

  return (
    <View style={[styles.container, { height }]}>
      {renderableImageUri ? (
        <AnimatedImageBackground
          source={{ uri: renderableImageUri }}
          style={[styles.image, imageFadeStyle]}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']}
            style={styles.gradient}
          />
          <Animated.View style={[styles.overlayBase, styles.overlayFull, fullOverlayStyle]}>
            <View style={styles.textBlock}>
              <ThemedText style={styles.name}>{name}</ThemedText>
              {infoRow(false)}
            </View>
            {renderEditButton(false)}
          </Animated.View>
        </AnimatedImageBackground>
      ) : (
        <View style={[styles.placeholder, { height }]}>
          <Animated.View style={[styles.overlayBase, styles.overlayFull, fullOverlayStyle]}>
            <View style={styles.textBlock}>
              <ThemedText style={styles.name}>{name}</ThemedText>
              {infoRow(false)}
            </View>
            {renderEditButton(false)}
          </Animated.View>
        </View>
      )}

      <Animated.View
        style={[
          styles.overlayBase,
          styles.overlayCompact,
          compactOverlayStyle,
          { paddingTop: topInset + 8 },
        ]}
      >
        <View style={styles.textBlockCompact}>
          <ThemedText style={styles.nameCompact}>{name}</ThemedText>
          {infoRow(true)}
        </View>
        {renderEditButton(true)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#1b1f22',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    justifyContent: 'flex-end',
  },
  placeholder: {
    width: '100%',
    backgroundColor: '#1b1f22',
    justifyContent: 'flex-end',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayBase: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  overlayFull: {
    bottom: 0,
    alignItems: 'flex-end',
    paddingBottom: 18,
    paddingTop: 60,
  },
  overlayCompact: {
    top: 0,
    alignItems: 'center',
    paddingBottom: 10,
    backgroundColor: '#0f1012',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  textBlock: {
    flex: 1,
    paddingRight: 12,
  },
  textBlockCompact: {
    flex: 1,
    paddingRight: 12,
  },
  name: {
    fontSize: 32,
    fontWeight: '700',
    color: '#f4f7f8',
  },
  nameCompact: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f4f7f8',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  infoRowCompact: {
    marginTop: 4,
  },
  strain: {
    fontSize: 16,
    color: '#d6dbe0',
  },
  strainCompact: {
    fontSize: 12,
    color: '#c8d0d5',
  },
  stagePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  stagePillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f4f7f8',
  },
  stageTextCompact: {
    fontSize: 10,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(120, 155, 130, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(200, 230, 210, 0.35)',
  },
  editButtonCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  editButtonTextCompact: {
    fontSize: 11,
  },
});
