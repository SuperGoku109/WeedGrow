export const plantThemes = {
  grove: { background: '#15231c', surface: '#23342a', elevated: '#2e4434', border: '#40523a', text: '#edf0e3', muted: '#a9bba1', accent: '#c8e78b', onAccent: '#243420', hero: '#eaf0d5', heroText: '#243420', water: '#a8d5df', warm: '#efb58d', danger: '#f0a999' },
  daylight: { background: '#f2f1e5', surface: '#fffef4', elevated: '#e7ecd9', border: '#cbd3b9', text: '#253c2b', muted: '#596d52', accent: '#365c37', onAccent: '#f2f5e7', hero: '#dee8c7', heroText: '#243420', water: '#316879', warm: '#975434', danger: '#aa4839' },
};
export type PlantTheme = { [K in keyof typeof plantThemes.grove]: string };
