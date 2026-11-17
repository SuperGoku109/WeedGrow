/** Semantic tokens shared by current and older garden screens. */
export const gardenThemes = {
  grove: { mode: 'dark', onWater: '#243420', onDanger: '#3b1614', scrim: '#08110c', shadow: '#000000', background: '#14231a', navigation: '#1b2e22', surface: '#2a4032', elevated: '#354b3b', border: '#7b8e72', text: '#edf0e3', muted: '#bac8b3', accent: '#c8e78b', onAccent: '#243420', hero: '#eaf0d5', heroText: '#243420', water: '#a8d5df', warm: '#efb58d', danger: '#f0a999' },
  daylight: { mode: 'light', onWater: '#ffffff', onDanger: '#ffffff', scrim: '#18251b', shadow: '#000000', background: '#f5f3e8', navigation: '#e9eedf', surface: '#fffef8', elevated: '#e6edda', border: '#7d8f72', text: '#253c2b', muted: '#596d52', accent: '#2f7047', onAccent: '#f5f8ed', hero: '#dce9c5', heroText: '#243420', water: '#2f7282', warm: '#a25030', danger: '#aa4839' },
  ocean: { mode: 'dark', onWater: '#15303c', onDanger: '#3b1614', scrim: '#08121b', shadow: '#000000', background: '#101f29', navigation: '#162832', surface: '#1c303d', elevated: '#294452', border: '#688995', text: '#e8f3f4', muted: '#abc7cf', accent: '#8edbd3', onAccent: '#153831', hero: '#cfe8e4', heroText: '#183b39', water: '#9acff4', warm: '#eac29a', danger: '#f2aaa9' },
  dusk: { mode: 'dark', onWater: '#2f2438', onDanger: '#3b1614', scrim: '#170f1c', shadow: '#000000', background: '#251e2b', navigation: '#2e2635', surface: '#372c3e', elevated: '#4a3b52', border: '#9b819f', text: '#f5ebf2', muted: '#cebcd1', accent: '#dab5ed', onAccent: '#35213f', hero: '#ead8e7', heroText: '#422d46', water: '#abd3e7', warm: '#ecc092', danger: '#f1a8b1' },
};
export const themeOptions = [
  { value: 'grove', label: 'Grove', description: 'Forest green · dark' },
  { value: 'daylight', label: 'Daylight', description: 'Warm cream · light' },
  { value: 'ocean', label: 'Ocean', description: 'Deep blue · dark' },
  { value: 'dusk', label: 'Dusk', description: 'Soft plum · dark' },
] as const;
export type GardenTheme = { [K in keyof typeof gardenThemes.grove]: string };
export const gardenLayout = { contentWidth: 760, touchTarget: 48, screenPadding: 20, controlGap: 12, cardRadius: 18 } as const;
/** Compact visuals with extra touch space; fields retain readable mobile input text. */
export const gardenControls = { height: 44, fieldHeight: 44, radius: 12, labelSize: 13, iconSize: 18, paddingHorizontal: 12, paddingVertical: 8, hitSlop: { top: 4, bottom: 4, left: 4, right: 4 } } as const;
export const gardenType = { title: 28, section: 20, body: 16, label: 14, caption: 13 } as const;
/** Adapters retain semantic roles while following the selected theme. */
export function flowPalette(theme: GardenTheme) {
  return { bg: theme.background, panel: theme.surface, input: theme.background, border: theme.border, ink: theme.text, muted: theme.muted, accent: theme.accent, dark: theme.onAccent, soft: theme.hero, heroText: theme.heroText, error: theme.danger, elevated: theme.elevated, water: theme.water, onWater: theme.onWater, onError: theme.onDanger, scrim: theme.scrim };
}
export function collectionInk(theme: GardenTheme) {
  return { ...theme, lime: theme.accent, dark: theme.onAccent };
}
export function colorAlpha(color: string, opacity: number) {
  return `${color}${Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0')}`;
}
