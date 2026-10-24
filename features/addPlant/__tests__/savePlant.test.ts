import { savePlantToFirestore, PlantSaveError } from '../api/savePlant';
import { runTransaction } from 'firebase/firestore';
import { preparePhotoRecord } from '@/lib/plants/photoRepository';
import { requireUserId } from '@/services/session';
import { fetchWeather } from '@/lib/weather/fetchWeather';
import type { PlantForm } from '@/features/plants/form/PlantForm';
jest.mock('@/services/session', () => ({ requireUserId: jest.fn(() => 'user-a') }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'plants'), doc: jest.fn((_db, ...parts) => ({ id: parts.at(-1) || 'generated', path: parts.join('/') })),
  runTransaction: jest.fn(), serverTimestamp: jest.fn(() => 'server-time'), arrayUnion: jest.fn(value => ({ arrayUnion: value })),
  Timestamp: { fromMillis: jest.fn(value => value), fromDate: jest.fn(date => date) },
}));
jest.mock('@/lib/plants/photoRepository', () => ({ preparePhotoRecord: jest.fn() }));
jest.mock('@/lib/weather/fetchWeather', () => ({ fetchWeather: jest.fn() }));
jest.mock('@/lib/weather/parseWeatherData', () => ({ parseWeatherData: jest.fn(value => value) }));
jest.mock('@/lib/weather/updateFirestore', () => ({ updateWeatherCache: jest.fn() }));
jest.mock('@/services/gardenData', () => ({ invalidatePlantCache: jest.fn() }));
const form: PlantForm = { name: ' Test plant ', strain: 'Blue Dream', strainType: 'hybrid', growthStage: 'clone', ageDays: '12', ageMode: 'estimate', environment: 'greenhouse', plantedIn: 'pot', potSize: '15L', sunlightExposure: 'Partial Sun', sensorProfileId: 'profile-a', location: { lat: 0, lng: 0 }, locationNickname: 'Patio', soilType: 'custom', soilPh: '6.5', permanentProtection: 'netting', companionPlants: ['Basil'], environmentNotes: 'Setup notes', wateringFrequency: 'Weekly', feedingFrequency: 'Every 14 days', fertilizer: 'Recorded product', pests: ['Aphids'], trainingTags: ['LST'], notes: 'Plant notes', imageUri: 'blob:photo' };
const set = jest.fn();
const update = jest.fn();
const get = jest.fn();
beforeEach(() => {
  jest.mocked(requireUserId).mockReturnValue('user-a');
  get.mockImplementation(async ref => ref.path.startsWith('plants/') ? { exists: () => false } : { exists: () => true, data: () => ({ createdBy: 'user-a', environment: 'greenhouse' }) });
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get, set, update } as never));
  jest.mocked(preparePhotoRecord).mockResolvedValue({ uri: 'firestore-photo:plants/plant-a/photoAssets/photo-a', writes: [{ ref: { path: 'asset-a' } as never, data: { dataUri: 'data:image/jpeg;base64,AAAA' } }] });
  jest.mocked(fetchWeather).mockResolvedValue({} as never);
});
it('commits ownership, separate dates, the photo assets and first gallery entry together', async () => {
  await expect(savePlantToFirestore(form, 'plant-a')).resolves.toBe('plant-a');
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ path: 'plants/plant-a' }), expect.objectContaining({ name: 'Test plant', ageDays: 12, ageKnown: true, ageEstimated: true, strain: 'Blue Dream', strainType: 'hybrid', owners: ['user-a'], createdAt: 'server-time', ageRecordedAt: 'server-time', feedingFrequency: 'Every 14 days' }));
  expect(set).toHaveBeenCalledWith({ path: 'asset-a' }, { dataUri: 'data:image/jpeg;base64,AAAA' });
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ path: 'plants/plant-a/progressPics/setup-photo' }), expect.objectContaining({ imageUrl: 'firestore-photo:plants/plant-a/photoAssets/photo-a' }));
  expect(fetchWeather).toHaveBeenCalledWith(0, 0);
});
it('does not write anything if photo preparation fails', async () => {
  jest.mocked(preparePhotoRecord).mockRejectedValueOnce(new Error('Invalid photo'));
  await expect(savePlantToFirestore(form, 'plant-a')).rejects.toThrow('prepared');
  expect(runTransaction).not.toHaveBeenCalled();
});
it('uses a stable plant ID on retry after a failed save', async () => {
  jest.mocked(runTransaction).mockRejectedValueOnce(new Error('Offline'));
  await expect(savePlantToFirestore(form, 'plant-a')).rejects.toThrow('details are still here');
  await savePlantToFirestore(form, 'plant-a');
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ path: 'plants/plant-a' }), expect.anything());
});
it('does not duplicate a committed plant or its initial history on retry', async () => {
  get.mockResolvedValue({ exists: () => true, data: () => ({ owners: ['user-a'] }) });
  await expect(savePlantToFirestore(form, 'plant-a')).resolves.toBe('plant-a');
  expect(set).not.toHaveBeenCalled();
});
it('does not accept another account’s retry ID', async () => {
  get.mockResolvedValue({ exists: () => true, data: () => ({ owners: ['other-user'] }) });
  await expect(savePlantToFirestore(form, 'plant-a')).rejects.toThrow('different account');
  expect(set).not.toHaveBeenCalled();
});
it('records only explicitly supplied watering and feeding dates', async () => {
  await savePlantToFirestore({ ...form, lastWateredOn: '2026-09-10', lastFedOn: '2026-09-09' }, 'plant-a');
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ path: 'plants/plant-a/logs/watering_2026-09-10' }), expect.objectContaining({ updatedBy: 'user-a', type: 'watering', calendarDay: '2026-09-10', timestamp: new Date('2026-09-10T12:00:00') }));
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ path: 'plants/plant-a/logs/setup-feeding' }), expect.objectContaining({ updatedBy: 'user-a', type: 'fertilizing' }));
});
it('adds membership to an owned growing space in the same transaction', async () => {
  await savePlantToFirestore({ ...form, groupId: 'space-a' }, 'plant-a');
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ path: 'groups/space-a' }), { plantIds: { arrayUnion: 'plant-a' }, updatedAt: 'server-time' });
});
it('rejects a missing or foreign space before any writes', async () => {
  get.mockResolvedValue({ exists: () => false });
  await expect(savePlantToFirestore({ ...form, groupId: 'gone' }, 'plant-a')).rejects.toBeInstanceOf(PlantSaveError);
  expect(set).not.toHaveBeenCalled();
});
it('rejects adding a plant to a full growing space before committing anything', async () => {
  get.mockImplementation(async ref => ref.path.startsWith('plants/') ? { exists: () => false } : {
    exists: () => true, data: () => ({ createdBy: 'user-a', environment: 'greenhouse', plantIds: Array.from({ length: 80 }, (_, index) => `existing-${index}`) }),
  });
  await expect(savePlantToFirestore({ ...form, groupId: 'full' }, 'plant-a')).rejects.toThrow('80 plants');
  expect(set).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
});
it('requires an account and rejects invalid input before preparing a photo', async () => {
  jest.mocked(requireUserId).mockImplementationOnce(() => { throw new Error('Sign in'); });
  await expect(savePlantToFirestore(form, 'plant-a')).rejects.toThrow('Sign in');
  await expect(savePlantToFirestore({ ...form, name: ' ' }, 'plant-a')).rejects.toThrow('name');
  expect(preparePhotoRecord).not.toHaveBeenCalled();
});
it('keeps unknown age separate from when the plant was added', async () => {
  await savePlantToFirestore({ name: 'Minimal', strain: '', growthStage: 'seedling', ageDays: '', ageMode: 'unknown', environment: 'outdoor', plantedIn: 'ground' }, 'minimal');
  expect(set).toHaveBeenCalledWith(expect.objectContaining({ path: 'plants/minimal' }), expect.objectContaining({ createdAt: 'server-time', startedOn: null, imageUri: null, location: null, ageKnown: false }));
  expect(preparePhotoRecord).not.toHaveBeenCalled();
});
