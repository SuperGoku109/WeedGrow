import { savePlantToFirestore } from '../api/savePlant';
import { runTransaction } from 'firebase/firestore';
import { uploadPlantImageUri } from '@/lib/plants/plantImages';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import { invalidatePlantCache } from '@/features/plants/hooks/usePlantList';
import type { PlantForm } from '@/features/plants/form/PlantForm';

jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'plants'), doc: jest.fn((...args) => ({ id: args[2] || 'generated-id' })),
  runTransaction: jest.fn(), serverTimestamp: jest.fn(() => 'server-time'),
  Timestamp: { fromMillis: jest.fn(value => value) },
}));
jest.mock('@/lib/plants/plantImages', () => ({ shouldUploadPlantImageUri: jest.fn(uri => !!uri && !uri.startsWith('https:')), uploadPlantImageUri: jest.fn() }));
jest.mock('@/lib/weather/fetchWeather', () => ({ fetchWeather: jest.fn() }));
jest.mock('@/lib/weather/parseWeatherData', () => ({ parseWeatherData: jest.fn(v => v) }));
jest.mock('@/lib/weather/updateFirestore', () => ({ updateWeatherCache: jest.fn() }));
jest.mock('@/features/plants/hooks/usePlantList', () => ({ invalidatePlantCache: jest.fn() }));

const form: PlantForm = { name: ' Test plant ', strain: 'Hybrid', growthStage: 'clone', ageDays: '12', environment: 'greenhouse', plantedIn: 'pot', potSize: '15L', sunlightExposure: 'Partial Sun', sensorProfileId: 'profile-a', location: { lat: 0, lng: 0 }, locationNickname: 'Patio', soilType: 'custom', soilPh: '6.5', permanentProtection: 'netting', companionPlants: ['Basil'], environmentNotes: 'Setup notes', wateringFrequency: 'Weekly', fertilizer: 'Recorded product', pests: ['Aphids'], trainingTags: ['LST'], notes: 'Plant notes', imageUri: 'blob:photo' };
const set = jest.fn();
beforeEach(() => {
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ exists: () => false }), set } as never));
  jest.mocked(uploadPlantImageUri).mockResolvedValue('https://example.com/photo.jpg');
  jest.mocked(fetchWeather).mockResolvedValue({} as never);
});

it('persists every collected field and only the uploaded photo URL', async () => {
  await expect(savePlantToFirestore(form, 'plant-a')).resolves.toBe('plant-a');
  expect(set).toHaveBeenCalledWith({ id: 'plant-a' }, expect.objectContaining({ ...form, name: 'Test plant', ageDays: 12, ageKnown: true, imageUri: 'https://example.com/photo.jpg', owners: ['demoUser'], status: 'active' }));
  expect(fetchWeather).toHaveBeenCalledWith(0, 0);
  expect(invalidatePlantCache).toHaveBeenCalledTimes(1);
});
it('does not create a partial plant if photo upload fails', async () => {
  jest.mocked(uploadPlantImageUri).mockRejectedValue(new Error('Upload failed'));
  await expect(savePlantToFirestore(form, 'plant-a')).rejects.toThrow('photo couldn’t upload');
  expect(runTransaction).not.toHaveBeenCalled();
});
it('returns a recoverable save error and preserves the retry ID', async () => {
  jest.mocked(runTransaction).mockRejectedValueOnce(new Error('Offline'));
  await expect(savePlantToFirestore(form, 'plant-a')).rejects.toThrow('details are still here');
  await expect(savePlantToFirestore(form, 'plant-a')).resolves.toBe('plant-a');
  expect(set.mock.calls[0][0]).toEqual({ id: 'plant-a' });
});
it('does not overwrite or duplicate an already committed retry', async () => {
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async () => ({ exists: () => true }), set } as never));
  await expect(savePlantToFirestore(form, 'plant-a')).resolves.toBe('plant-a');
  expect(set).not.toHaveBeenCalled();
});
it('saves without optional data and rejects invalid input before upload', async () => {
  await savePlantToFirestore({ name: 'Minimal', strain: '', growthStage: 'seedling', ageDays: '', environment: 'outdoor', plantedIn: 'ground' }, 'minimal');
  expect(set.mock.calls[0][1]).toMatchObject({ imageUri: null, location: null, ageKnown: false, companionPlants: [] });
  await expect(savePlantToFirestore({ ...form, name: ' ' }, 'invalid')).rejects.toThrow('name');
  expect(uploadPlantImageUri).not.toHaveBeenCalled();
});
