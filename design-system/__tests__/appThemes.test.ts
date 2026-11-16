import { appThemes } from '../appThemes';
import { gardenThemes, colorAlpha, flowPalette, collectionInk } from '../tokens/garden';
import { legacyThemeColors } from '../utils/useTheme';

function luminance(color: string) {
  const channels = color.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(first: string, second: string) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

it.each(Object.entries(gardenThemes))('%s keeps library colors, palette adapters and mode aligned', (_name, t) => {
  const { light, paper, navigation } = appThemes(t);
  expect(light).toBe(t.mode === 'light');
  expect(paper.dark).toBe(!light);
  expect(navigation.dark).toBe(!light);
  expect(paper.colors).toMatchObject({ primary: t.accent, onPrimary: t.onAccent, surface: t.surface, onSurface: t.text, secondary: t.water, onSecondary: t.onWater, error: t.danger, onError: t.onDanger });
  expect(Object.values(paper.colors.elevation).slice(1)).toEqual([t.surface, t.elevated, t.elevated, t.elevated, t.elevated]);
  expect(navigation.colors).toMatchObject({ background: t.background, card: t.surface, text: t.text });
  expect(flowPalette(t)).toMatchObject({ panel: t.surface, ink: t.text, elevated: t.elevated, heroText: t.heroText });
  expect(collectionInk(t)).toMatchObject({ surface: t.surface, text: t.text, lime: t.accent });
  expect(legacyThemeColors(t)).toMatchObject({ background: { primary: t.background, card: t.surface }, text: { primary: t.text, secondary: t.muted }, brand: { primary: t.accent }, onPrimary: t.onAccent });
});

it.each(Object.entries(gardenThemes))('%s provides readable semantic text/background pairs', (_name, t) => {
  for (const [foreground, background] of [
    [t.text, t.background], [t.text, t.surface], [t.text, t.elevated],
    [t.muted, t.surface], [t.muted, t.elevated], [t.accent, t.elevated],
    [t.onAccent, t.accent], [t.onWater, t.water], [t.onDanger, t.danger], [t.heroText, t.hero],
  ]) expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
});

it('uses bounded alpha without changing the selected hue', () => {
  expect(colorAlpha('#123456', .5)).toBe('#12345680');
  expect(colorAlpha('#123456', -1)).toBe('#12345600');
  expect(colorAlpha('#123456', 2)).toBe('#123456ff');
});
