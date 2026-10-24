import { normalizePlantForm, validatePlantForm } from '../plantFlowModel';
import type { PlantForm } from '@/features/plants/form/PlantForm';

const form: PlantForm = { name: 'Fern', strain: '', growthStage: 'seedling', ageDays: '', environment: 'outdoor', plantedIn: 'pot' };

describe('plant creation validation', () => {
  it('only follows a growing space when one is actually selected', () => {
    expect(normalizePlantForm({ ...form, locationMode: 'space', groupId: '  ' }).locationMode).toBe('custom');
    expect(normalizePlantForm({ ...form, locationMode: 'space', groupId: 'home' }).locationMode).toBe('space');
    expect(normalizePlantForm({ ...form, locationMode: 'custom', groupId: 'home' }).locationMode).toBe('custom');
  });
  it('requires an explicit stage and supports unknown age', () => {
    expect(validatePlantForm({ ...form, growthStage: '', ageMode: 'unknown' }).growthStage).toBeTruthy();
    expect(normalizePlantForm({ ...form, ageMode: 'unknown', ageDays: '42', startedOn: '2026-09-01' })).toMatchObject({ ageDays: '', startedOn: '', ageEstimated: false });
  });
  it('keeps known dates and approximate ages distinct using calendar days', () => {
    expect(normalizePlantForm({ ...form, ageMode: 'date', startedOn: '2026-10-01' }, '2026-10-17')).toMatchObject({ ageDays: '16', startedOn: '2026-10-01', ageEstimated: false });
    expect(normalizePlantForm({ ...form, ageMode: 'estimate', ageDays: '16' }, '2026-10-17')).toMatchObject({ startedOn: '2026-10-01', ageEstimated: true });
    expect(validatePlantForm({ ...form, ageMode: 'date', startedOn: '2026-02-30' }, '2026-10-17').startedOn).toBeTruthy();
  });
  it('rejects future care and care before a known start date', () => {
    expect(validatePlantForm({ ...form, lastWateredOn: '2026-10-18' }, '2026-10-17').lastWateredOn).toBeTruthy();
    expect(validatePlantForm({ ...form, ageMode: 'date', startedOn: '2026-10-01', lastFedOn: '2026-09-30' }, '2026-10-17').lastFedOn).toBeTruthy();
    expect(validatePlantForm({ ...form, latitudeInput: 'abc', longitudeInput: '18' }).location).toBeTruthy();
  });
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
