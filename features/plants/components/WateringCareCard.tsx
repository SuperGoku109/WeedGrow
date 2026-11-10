import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { GrowPress } from '@/ui/GrowMotion';
import type { Plant } from '@/firestoreModels';
import type { PlantTheme } from './plantDetailTheme';
import PlantEditorSheet from './PlantEditorSheet';

function WaterIcon({ color }: { color: string }) {
  return <Svg width={22} height={26} viewBox="0 0 24 28" accessible={false}><Path d="M12 2C10 6 4 12 4 17a8 8 0 0 0 16 0C20 12 14 6 12 2Z" fill="none" stroke={color} strokeWidth={1.6} /><Path d="M8 17a4 4 0 0 0 4 4" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" /></Svg>;
}
/** An illustration for layout review, with no numerical care recommendations. */
function SeasonalPreview({ theme: t, expanded = false }: { theme: PlantTheme; expanded?: boolean }) {
  return <View accessible accessibilityLabel="Seasonal chart design preview. Illustrative curve only; no watering recommendations are calculated.">
    <Svg width="100%" height={expanded ? 225 : 155} viewBox="0 0 340 180">
      {[35, 80, 125].map(y => <Line key={y} x1={12} x2={328} y1={y} y2={y} stroke={t.border} strokeOpacity={.45} />)}
      <Path d="M12 45 C32 45 40 38 57 48 S86 96 111 103 S142 132 169 131 S207 123 224 100 S253 76 274 53 S306 38 328 45" fill="none" stroke={t.water} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
      {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map((month, i) => <SvgText key={month} x={16 + i * 61} y={167} textAnchor={i === 0 ? 'start' : i === 5 ? 'end' : 'middle'} fill={t.muted} fontFamily="sans-serif" fontSize={12}>{month}</SvgText>)}
    </Svg>
  </View>;
}
function PreviewLabel({ theme: t }: { theme: PlantTheme }) {
  return <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, backgroundColor: t.elevated }}><Text style={{ color: t.muted, fontSize: 11, fontWeight: '500' }}>Design preview</Text></View>;
}
export default function WateringCareCard({ plant, theme: t }: { plant: Plant; theme: PlantTheme }) {
  const [open, setOpen] = React.useState(false);
  const location = plant.locationNickname?.trim() || plant.locationLabel?.trim();
  const sections = [
    ['Seasonal patterns', 'A short explanation of how the annual pattern changes through the seasons will appear here.'],
    ['Your location', location ? 'Location context for ' + location + ' will appear here.' : 'Local context will appear here once a location is added.'],
    ['Your growing setup', 'Information about the container, growing medium and exposure will appear here.'],
    ['Watering guidance', 'The detailed care guide will appear here.'],
  ];
  return <View style={{ backgroundColor: t.surface, borderRadius: 20, padding: 22, gap: 12, marginTop: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.elevated, alignItems: 'center', justifyContent: 'center' }}><WaterIcon color={t.water} /></View>
      <View style={{ flex: 1, gap: 4 }}><Text style={{ color: t.text, fontSize: 20, fontWeight: '600' }}>Water</Text><Text style={{ color: t.muted, fontSize: 13 }}>Seasonal overview</Text></View>
    </View>
    <SeasonalPreview theme={t} />
    <PreviewLabel theme={t} />
    <Text style={{ color: t.muted, fontSize: 12, lineHeight: 19 }}>Illustrative curve. Seasonal estimates have not been connected.</Text>
    <GrowPress accessibilityRole="button" accessibilityLabel="Learn more about watering" onPress={() => setOpen(true)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}><Text style={{ color: t.water, fontSize: 14, fontWeight: '600' }}>Learn more</Text></GrowPress>
    {open && <PlantEditorSheet title="Watering" subtitle={plant.name} theme={t} onClose={() => setOpen(false)} contentGap={26}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: t.muted, fontSize: 13 }}>Annual overview</Text>
        <SeasonalPreview theme={t} expanded />
        <PreviewLabel theme={t} />
        <Text style={{ color: t.muted, fontSize: 12, lineHeight: 20 }}>This is a layout preview with placeholder content. The curve does not represent calculated watering intervals.</Text>
      </View>
      {sections.map(([title, body]) => <View key={title} style={{ gap: 9, borderTopWidth: 1, borderColor: t.border, paddingTop: 22 }}>
        <Text accessibilityRole="header" style={{ color: t.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
        <Text style={{ color: t.muted, fontSize: 14, lineHeight: 24 }}>{body}</Text>
      </View>)}
    </PlantEditorSheet>}
  </View>;
}
