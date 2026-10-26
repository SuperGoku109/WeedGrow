import { decodePlant, decodeGroup, decodeLog, decodeWeather, decodePhoto, RecordDecodeError } from '../recordDecoders';
const timestamp = { toDate: () => new Date(0), toMillis: () => 0 };
const plant = { name: 'Plant', owners: ['owner'], growthStage: 'seedling', status: 'active', environment: 'outdoor', plantedIn: 'pot' };
it('keeps absent legacy metadata unknown while validating the fields used by the app', () => {
  expect(decodePlant(plant, 'plants/p')).toMatchObject({ strain: '', createdAt: null, updatedAt: null });
  expect(decodePlant({ ...plant, location: { lat: 0, lng: 0 } }, 'plants/p').location).toEqual({ lat: 0, lng: 0 });
  expect(() => decodePlant({ ...plant, owners: 'owner' }, 'plants/p')).toThrow(RecordDecodeError);
  expect(() => decodePlant({ ...plant, height: Infinity }, 'plants/p')).toThrow('height');
});
it('rejects malformed nested records instead of silently losing them from totals', () => {
  expect(() => decodeGroup({ name: 'Space', createdBy: 'owner', environment: 'outdoor', plantIds: [12] }, 'groups/g')).toThrow('plantIds');
  expect(() => decodeLog({ type: 'watering', timestamp: 'yesterday' }, 'plants/p/logs/l')).toThrow('timestamp');
  expect(() => decodeWeather({ date: '2026-02-30', fetchedAt: timestamp }, 'plants/p/weatherCache/x')).toThrow('date');
  expect(() => decodePhoto({ imageUrl: { url: 'bad' } }, 'image', 'plants/p/progressPics/image')).toThrow('imageUrl');
});
it('accepts real timestamp behaviour and legacy photo URL fields', () => {
  expect(decodeLog({ type: 'note', timestamp }, 'plants/p/logs/l').updatedBy).toBe('');
  expect(decodePhoto({ url: 'https://example.test/photo.jpg', timestamp }, 'image', 'photos/image').imageUrl).toBe('https://example.test/photo.jpg');
});
