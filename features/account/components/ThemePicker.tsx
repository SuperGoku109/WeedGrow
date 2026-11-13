import React from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { gardenThemes, themeOptions } from '@/design-system/tokens/garden';
import { usePlantAppearance } from '@/hooks/usePlantAppearance';
import { savePlantAppearance, type PlantAppearance } from '@/services/plantAppearance';
import { GrowPress } from '@/ui/GrowMotion';

export default function ThemePicker() {
  const appearance = usePlantAppearance();
  const t = gardenThemes[appearance.themeName];
  const [saving, setSaving] = React.useState(false), [error, setError] = React.useState('');
  const lock = React.useRef(false);
  const choose = async (value: PlantAppearance) => {
    if (lock.current || value === appearance.themeName) return;
    lock.current = true; setSaving(true); setError('');
    try { await savePlantAppearance(value); }
    catch { setError('Theme could not be saved. Please try again.'); }
    finally { lock.current = false; setSaving(false); }
  };
  return <View style={{ backgroundColor: t.surface, borderRadius: 18, padding: 16, gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><MaterialCommunityIcons name="palette-outline" size={21} color={t.accent} /><Text accessibilityRole="header" style={{ color: t.text, fontSize: 18, fontWeight: '600' }}>Themes</Text></View>
    <View accessibilityRole="radiogroup" accessibilityLabel="App theme" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {themeOptions.map(option => {
        const palette = gardenThemes[option.value], selected = appearance.themeName === option.value;
        return <GrowPress key={option.value} containerStyle={{ flexBasis: '46%', flexGrow: 1 }} accessibilityRole="radio" aria-checked={selected} accessibilityLabel={`${option.label}, ${option.description}`} accessibilityState={{ checked: selected, disabled: saving }} disabled={saving || appearance.status === 'loading'} onPress={() => void choose(option.value)} style={{ backgroundColor: palette.background, borderWidth: 2, borderColor: selected ? t.accent : t.elevated, borderRadius: 14, padding: 12, gap: 10 }}>
          <View style={{ backgroundColor: palette.surface, padding: 9, borderRadius: 8, gap: 6 }}>
            <View style={{ backgroundColor: palette.elevated, width: '65%', height: 5, borderRadius: 3 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ backgroundColor: palette.text, opacity: .7, width: '42%', height: 4, borderRadius: 2 }} /><View style={{ backgroundColor: palette.accent, width: 20, height: 12, borderRadius: 4 }} /></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Text style={{ flex: 1, color: palette.text, fontSize: 14, fontWeight: '600' }}>{option.label}</Text><MaterialCommunityIcons name={selected ? 'check-circle' : 'circle-outline'} size={18} color={selected ? palette.accent : palette.muted} /></View>
          <Text style={{ color: palette.muted, fontSize: 11, lineHeight: 16 }}>{option.description}</Text>
        </GrowPress>;
      })}
    </View>
    {!!(error || appearance.error) && <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13 }}>{error || appearance.error}</Text>}
  </View>;
}
