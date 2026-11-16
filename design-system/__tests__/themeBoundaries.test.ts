import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

it('keeps fixed Grove surfaces out of components and screens', () => {
  const root = join(__dirname, '../..');
  // Artwork and photo overlays have deliberate colors independent of UI surfaces.
  const artwork = new Set(['features/plants/components/PlantBanner.tsx']);
  const violations: string[] = [];
  for (const folder of ['app', 'features', 'ui', 'design-system/components']) {
    for (const file of readdirSync(join(root, folder), { recursive: true }) as string[]) {
      if (!/\.tsx?$/.test(file) || file.includes('__tests__')) continue;
      const absolute = join(root, folder, file);
      const name = relative(root, absolute).replaceAll('\\', '/');
      const source = readFileSync(absolute, 'utf8');
      if (/(?:const|let)\s+\w+\s*=\s*(?:gardenThemes|plantThemes)\.grove\s*;/.test(source)) violations.push(`${name}: fixed Grove theme`);
      const styleSource = source.replace(/export const environments = \{[\s\S]*?\n\};/, '');
      if (/ColorTokens\.(?:text|background|brand|border|status)/.test(source)) violations.push(`${name}: static legacy colors`);
      if (!artwork.has(name) && /\b(?:backgroundColor|borderColor|color):\s*['"]#[\da-f]{3,8}['"]/i.test(styleSource)) violations.push(`${name}: fixed UI color`);
    }
  }
  expect(violations).toEqual([]);
});
