import { PlantImage as Image } from '@/ui/PlantImage';
import React from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { ThemedText } from '@/ui/ThemedText';

interface ProgressPic {
  id: string;
  imageUrl: string;
}

interface ProgressGalleryProps {
  pics: ProgressPic[];
  loading: boolean;
}

export default function ProgressGallery({ pics, loading }: ProgressGalleryProps) {
  const numColumns = 3;
  const size = Math.floor(Dimensions.get('window').width / numColumns) - 8;

  return (
    <View style={styles.container}>
      <ThemedText style={styles.title}>Progress Gallery</ThemedText>

      {loading ? (
        <ThemedText>Loading...</ThemedText>
      ) : (
        <FlatList
          data={pics}
          keyExtractor={(item) => item.id}
          numColumns={numColumns}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.imageWrapper}>
              <Image
                source={{ uri: item.imageUrl }}
                style={[styles.image, { width: size, height: size }]}
              />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 8 },
  title: { fontWeight: 'bold', fontSize: 20, marginBottom: 12 },
  imageWrapper: { margin: 4 },
  image: { borderRadius: 10, backgroundColor: '#e0e7ef' },
});
