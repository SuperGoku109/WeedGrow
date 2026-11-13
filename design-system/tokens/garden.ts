/** Semantic tokens shared by current and older garden screens. */
export const gardenThemes = {
  grove: { background: '#15231c', surface: '#23342a', elevated: '#2e4434', border: '#7b8e72', text: '#edf0e3', muted: '#bac8b3', accent: '#c8e78b', onAccent: '#243420', hero: '#eaf0d5', heroText: '#243420', water: '#a8d5df', warm: '#efb58d', danger: '#f0a999' },
  daylight: { background: '#f5f3e8', surface: '#fffef8', elevated: '#e6edda', border: '#829477', text: '#253c2b', muted: '#596d52', accent: '#2f7047', onAccent: '#f5f8ed', hero: '#dce9c5', heroText: '#243420', water: '#2f7282', warm: '#a65332', danger: '#aa4839' },
  ocean: { background: '#101f29', surface: '#1c303d', elevated: '#294452', border: '#688995', text: '#e8f3f4', muted: '#abc7cf', accent: '#8edbd3', onAccent: '#153831', hero: '#cfe8e4', heroText: '#183b39', water: '#9acff4', warm: '#eac29a', danger: '#f2aaa9' },
  dusk: { background: '#251e2b', surface: '#372c3e', elevated: '#4a3b52', border: '#9b819f', text: '#f5ebf2', muted: '#cebcd1', accent: '#dab5ed', onAccent: '#35213f', hero: '#ead8e7', heroText: '#422d46', water: '#abd3e7', warm: '#ecc092', danger: '#f1a8b1' },
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
export const gardenControls = { height: 40, fieldHeight: 44, radius: 12, labelSize: 13, iconSize: 18, paddingHorizontal: 12, paddingVertical: 8, hitSlop: { top: 4, bottom: 4, left: 4, right: 4 } } as const;
export const gardenType = { title: 28, section: 20, body: 16, label: 14, caption: 13 } as const;
const theme = gardenThemes.grove;
export const gardenFlowPalette = { bg: theme.background, panel: theme.surface, input: theme.background, border: theme.border, ink: theme.text, muted: theme.muted, accent: theme.accent, dark: theme.onAccent, soft: theme.hero, error: theme.danger };
export const gardenCollectionInk = { background: theme.background, surface: theme.surface, border: theme.border, text: theme.text, muted: theme.muted, lime: theme.accent, dark: theme.onAccent };
