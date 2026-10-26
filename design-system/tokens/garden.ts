/** Semantic tokens shared by current and older garden screens. */
export const gardenThemes = {
  grove: { background: '#15231c', surface: '#23342a', elevated: '#2e4434', border: '#7b8e72', text: '#edf0e3', muted: '#bac8b3', accent: '#c8e78b', onAccent: '#243420', hero: '#eaf0d5', heroText: '#243420', water: '#a8d5df', warm: '#efb58d', danger: '#f0a999' },
  daylight: { background: '#f2f1e5', surface: '#fffef4', elevated: '#e7ecd9', border: '#748368', text: '#253c2b', muted: '#596d52', accent: '#365c37', onAccent: '#f2f5e7', hero: '#dee8c7', heroText: '#243420', water: '#316879', warm: '#975434', danger: '#aa4839' },
};
export type GardenTheme = { [K in keyof typeof gardenThemes.grove]: string };
export const gardenLayout = { contentWidth: 760, touchTarget: 48, screenPadding: 20, controlGap: 12, cardRadius: 18 } as const;
export const gardenType = { title: 28, section: 20, body: 16, label: 14, caption: 13 } as const;
const theme = gardenThemes.grove;
export const gardenFlowPalette = { bg: theme.background, panel: theme.surface, input: theme.background, border: theme.border, ink: theme.text, muted: theme.muted, accent: theme.accent, dark: theme.onAccent, soft: theme.hero, error: theme.danger };
export const gardenCollectionInk = { background: theme.background, surface: theme.surface, border: theme.border, text: theme.text, muted: theme.muted, lime: theme.accent, dark: theme.onAccent };
