import { PlantImage as Image } from '@/ui/PlantImage';
import React from 'react';
import { FlatList } from 'react-native';
import { Plant } from '@/firestoreModels';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { getRenderablePlantImageUri } from '@/lib/plants/plantImages';

interface GalleryBarProps {
  plant: Plant;
  progressPics: string[];
}

export default function GalleryBar({ plant, progressPics }: GalleryBarProps) {
  const theme = (useColorScheme() ?? 'dark') as keyof typeof Colors;

  const galleryImages = [
    getRenderablePlantImageUri(plant?.imageUri),
    ...progressPics
      .map((url) => getRenderablePlantImageUri(url))
      .filter((url) => url && url !== getRenderablePlantImageUri(plant?.imageUri)),
  ].filter((url): url is string => Boolean(url));

  return (
    <FlatList
      data={galleryImages}
      horizontal
      keyExtractor={(item, idx) => (item ? item : 'img') + idx}
      contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center', height: 96 }}
      showsHorizontalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <Image
          source={{ uri: item }}
          style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            marginRight: 14,
            backgroundColor: '#eee',
            borderWidth: index === 0 ? 2 : 0,
            borderColor: index === 0 ? Colors[theme].tint : undefined,
          }}
        />
      )}
    />
  );
}
