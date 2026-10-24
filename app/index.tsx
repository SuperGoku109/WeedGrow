import { Redirect, useLocalSearchParams } from 'expo-router';
export default function Index() {
  const { tabIndex } = useLocalSearchParams<{ tabIndex?: string | string[] }>();
  const selected = Array.isArray(tabIndex) ? tabIndex[0] : tabIndex;
  return <Redirect href={{ pathname: '/(tabs)', params: selected === '1' ? { tabIndex: '1' } : {} }} />;
}
