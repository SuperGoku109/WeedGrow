import { useAppTheme } from '@/hooks/useAppTheme';
import React from 'react';
import { Text, View } from 'react-native';
import { PlantImage } from '@/ui/PlantImage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePlant } from '../hooks/usePlant';
import PlantSectionEditor from '../components/PlantSectionEditor';
import LoadingView from '../components/LoadingView';
import NotFoundView from '../components/NotFoundView';
import LoadError from '@/ui/LoadError';

export default function EditPlantScreen() {
  const params = useLocalSearchParams<{ id: string; theme?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { plant, loading, error, refresh } = usePlant(id);
  const theme = useAppTheme();
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/plant/[id]', params: { id, section: 'Details' } });
  };
  if (loading) return <LoadingView onBack={back} />;
  if (!plant && error) return <LoadError message={error} onRetry={refresh} onBack={back} />;
  if (!plant) return <NotFoundView />;
  return <PlantSectionEditor key={id} plantId={id} plant={plant} section="All" presentation="page" portrait={plant.imageUri ? <PlantImage accessibilityLabel={plant.name + " photo"} source={{ uri: plant.imageUri }} fullSize style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Text style={{ color: theme.muted, fontSize: 12 }}>Plant photo</Text></View>} theme={theme} onClose={back} onSaved={back} onDeleted={() => router.replace('/')} />;
}
