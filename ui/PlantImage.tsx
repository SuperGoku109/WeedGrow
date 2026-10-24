import { useSession } from '@/services/session';
import React from 'react';
import { Image, View, Text, type ImageProps } from 'react-native';
import { isStoredPhoto, loadPhoto } from '@/lib/plants/photoRepository';

/** Shared adapter: legacy URLs and local previews still work alongside stored photos. */
export function usePhotoUri(uri?: string | null, fullSize = false) {
  const { user } = useSession();
  const stored = !!uri && isStoredPhoto(uri);
  const [resolved, setResolved] = React.useState<{ key: string; uri?: string; failed?: boolean }>();
  const key = `${user?.uid || ''}:${uri}:${fullSize}`;
  React.useEffect(() => {
    if (!stored || !uri || !user) return;
    let active = true;
    loadPhoto(uri, fullSize).then(value => { if (active) setResolved({ key, uri: value }); })
      .catch(() => { if (active) setResolved({ key, failed: true }); });
    return () => { active = false; };
  }, [uri, stored, fullSize, key, user]);
  return { uri: stored ? resolved?.key === key ? resolved.uri : undefined : uri, failed: stored && resolved?.key === key && resolved.failed, stored };
}

export function PlantImage({ source, fullSize = false, ...props }: ImageProps & { fullSize?: boolean }) {
  const uri = source && !Array.isArray(source) && typeof source === 'object' ? source.uri : undefined;
  const photo = usePhotoUri(uri, fullSize);
  if (!photo.stored) return <Image {...props} source={source} />;
  if (photo.uri) return <Image {...props} source={{ uri: photo.uri }} />;
  return <View style={props.style} accessibilityLabel={photo.failed ? 'Photo unavailable' : 'Loading photo'}>{photo.failed && <Text style={{ color: '#889785', fontSize: 11 }}>Photo unavailable</Text>}</View>;
}
