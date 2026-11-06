import { buildSectionUpdates, sections } from '../form/plantSectionForm';
import { validatePlantFields } from '@/lib/plants/plantValidation';
import { rainExposure, rainReception } from '@/lib/careAlgorithm/setupFacts';
import { makePlantSummary } from '@/lib/suggestions/__tests__/fixtures';
const plant = makePlantSummary();
const values = () => Object.fromEntries(sections['Growing setup'].map(f => [f.key, String((plant as any)[f.key] ?? '')]));
test('one optional exposure choice produces explicit soil/canopy facts without a guessed percentage', () => {
  const output = buildSectionUpdates('Growing setup', { ...values(), rainExposure: 'soil_sheltered', careMedium: 'coco' }, 'custom', plant);
  expect(output).toMatchObject({ rainReception: { soil: 'no', canopy: 'yes' }, careMedium: 'coco' });
  expect(output).not.toHaveProperty('rainExposure');
  expect(rainReception('partial')).toEqual({ soil: 'partial', canopy: 'partial' });
});
test('legacy and skipped facts stay unknown and unrelated edits preserve unmatched combinations', () => {
  expect(rainExposure(plant)).toBe('unknown');
  const old = { ...plant, rainReception: { soil: 'no' as const, canopy: 'unknown' as const } };
  const output = buildSectionUpdates('Growing setup', { ...values(), rainExposure: 'unknown' }, 'custom', old);
  expect(output).not.toHaveProperty('rainReception'); expect(output.careMedium).toBeNull();
});
test('invalid medium or reception is rejected at the write boundary', () => {
  expect(validatePlantFields({ careMedium: 'made-up-hydraulics' })).toHaveProperty('careMedium');
  expect(validatePlantFields({ rainReception: { soil: true, canopy: 'yes' } })).toHaveProperty('rainReception');
  expect(validatePlantFields({ rainReception: { soil: ['yes'], canopy: 'yes' } })).toHaveProperty('rainReception');
});
