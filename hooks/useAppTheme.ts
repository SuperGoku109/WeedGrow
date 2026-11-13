import { gardenThemes } from '@/design-system/tokens/garden';
import { usePlantAppearance } from './usePlantAppearance';

export function useAppTheme() {
  const { themeName } = usePlantAppearance();
  return gardenThemes[themeName];
}
