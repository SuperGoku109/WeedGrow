export const HEIGHT_UNITS = [
  { unit: 'cm', name: 'Centimetres', centimetres: 1 },
  { unit: 'mm', name: 'Millimetres', centimetres: 0.1 },
  { unit: 'm', name: 'Metres', centimetres: 100 },
  { unit: 'in', name: 'Inches', centimetres: 2.54 },
  { unit: 'ft', name: 'Feet', centimetres: 30.48 },
] as const;
export type HeightUnit = typeof HEIGHT_UNITS[number]['unit'];
const factor = (unit: HeightUnit) => HEIGHT_UNITS.find(item => item.unit === unit)!.centimetres;
export function heightInCentimetres(raw: string, unit: HeightUnit): string {
  if (!raw.trim()) return '';
  const normalized = raw.trim().replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? String(Number((value * factor(unit)).toFixed(8))) : normalized;
}
export function displayHeight(centimetres: string, unit: HeightUnit): string {
  if (!centimetres.trim()) return '';
  const value = Number(centimetres);
  return Number.isFinite(value) ? String(Number((value / factor(unit)).toPrecision(12))) : centimetres;
}
