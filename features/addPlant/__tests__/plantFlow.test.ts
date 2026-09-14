import { normalizePlantForm, validatePlantForm } from '../plantFlowModel';
import type { PlantForm } from '@/features/plants/form/PlantForm';

const form: PlantForm = { name: 'Fern', strain: '', growthStage: 'seedling', ageDays: '', environment: 'outdoor', plantedIn: 'pot' };

describe('plant creation validation', () => {
  it('allows a minimal plant without age, photo, or location', () => {
    expect(validatePlantForm(form)).toEqual({});
  });
  it.each(['germination', 'seedling', 'vegetative', 'flowering', 'clone'])('supports the existing %s stage', growthStage => {
    expect(validatePlantForm({ ...form, growthStage })).toEqual({});
  });
  it.each(['-1', '1.5', 'abc', '4days', '999999'])('rejects invalid age %s', ageDays => {
    expect(validatePlantForm({ ...form, ageDays }).ageDays).toBeTruthy();
  });
  it('rejects blank names and invalid pH', () => {
    expect(validatePlantForm({ ...form, name: '   ', soilPh: '15' })).toHaveProperty('name');
    expect(validatePlantForm({ ...form, soilPh: '-1' })).toHaveProperty('soilPh');
    expect(validatePlantForm({ ...form, soilPh: '6.5' })).toEqual({});
  });
  it('accepts zero coordinates and rejects out of range coordinates', () => {
    expect(validatePlantForm({ ...form, location: { lat: 0, lng: 0 } })).toEqual({});
    expect(validatePlantForm({ ...form, location: { lat: 91, lng: 0 } })).toHaveProperty('location');
    expect(validatePlantForm({ ...form, location: { lat: 0, lng: NaN } })).toHaveProperty('location');
  });
  it('clears hidden incompatible fields but preserves all extra setup data', () => {
    const result = normalizePlantForm({ ...form, name: ' Fern ', environment: 'indoor', plantedIn: 'ground', potSize: '10L', sunlightExposure: 'Full Sun', soilType: 'custom', soilPh: '6.5', permanentProtection: 'netting', companionPlants: [' Basil ', '', 'Basil', 'Mint'], environmentNotes: ' Green corner ' });
    expect(result).toMatchObject({ name: 'Fern', potSize: '', sunlightExposure: '', soilType: 'custom', soilPh: '6.5', permanentProtection: 'netting', companionPlants: ['Basil', 'Mint'], environmentNotes: 'Green corner' });
    expect(normalizePlantForm({ ...form, sensorProfileId: 'indoor-profile' }).sensorProfileId).toBeNull();
  });
});
