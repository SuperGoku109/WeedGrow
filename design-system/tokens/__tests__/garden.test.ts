import { gardenThemes, gardenLayout } from '../garden';

function luminance(hex: string) {
  const values = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}
function contrast(a: string, b: string) { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

describe.each(Object.entries(gardenThemes))('%s semantic contrast', (_name, theme) => {
  it('keeps readable foreground roles above 4.5:1 on their supported surfaces', () => {
    for (const surface of ['background', 'surface', 'elevated'] as const) for (const foreground of ['text', 'muted', 'accent', 'water', 'warm', 'danger'] as const) {
      expect(contrast(theme[foreground], theme[surface])).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.heroText, theme.hero)).toBeGreaterThanOrEqual(4.5);
  });
  it('keeps input boundaries visible against supported input backgrounds', () => {
    expect(contrast(theme.border, theme.background)).toBeGreaterThanOrEqual(3);
    expect(contrast(theme.border, theme.surface)).toBeGreaterThanOrEqual(3);
  });
});
it('uses a touch target at least 48 points', () => expect(gardenLayout.touchTarget).toBeGreaterThanOrEqual(48));
