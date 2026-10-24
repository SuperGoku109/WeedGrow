import { getDoc } from 'firebase/firestore';
import { preparePlantPhoto } from '../preparePlantPhoto';
import { isStoredPhoto, loadPhoto, preparePhotoRecord } from '../photoRepository';
jest.mock('@/services/session', () => ({ requireUserId: jest.fn(() => 'user-a') }));
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, ...parts) => parts.join('/')),
  doc: jest.fn((...args) => typeof args[0] === 'string' ? { id: 'photo-a', path: args[0] + '/photo-a' } : { id: args.at(-1), path: args.slice(1).join('/') }),
  getDoc: jest.fn(),
}));
jest.mock('../preparePlantPhoto', () => ({ preparePlantPhoto: jest.fn() }));
it('prepares separate full and thumbnail records without writing remotely', async () => {
  jest.mocked(preparePlantPhoto).mockResolvedValue({ image: 'full-image', thumbnail: 'small-image' });
  const photo = await preparePhotoRecord('plant-a', 'blob:photo');
  expect(photo.uri).toBe('firestore-photo:plants/plant-a/photoAssets/photo-a');
  expect(photo.writes.map(write => write.data)).toEqual([{ dataUri: 'full-image' }, { dataUri: 'small-image' }]);
});
it('retains existing references and legacy hosted URLs without recompressing', async () => {
  for (const uri of ['https://example.com/photo.jpg', 'firestore-photo:plants/plant-a/photoAssets/photo-a']) {
    expect(await preparePhotoRecord('plant-a', uri)).toEqual({ uri, writes: [] });
  }
  expect(preparePlantPhoto).not.toHaveBeenCalled();
  expect(isStoredPhoto('firestore-photo:users/private')).toBe(false);
});
it('deduplicates thumbnail reads and fetches the full image only on request', async () => {
  jest.mocked(getDoc).mockResolvedValue({ data: () => ({ dataUri: 'data:image/jpeg;base64,AAAA' }) } as never);
  const uri = 'firestore-photo:plants/cache-test/photoAssets/photo-a';
  await Promise.all([loadPhoto(uri), loadPhoto(uri)]);
  expect(getDoc).toHaveBeenCalledTimes(1);
  expect(getDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'plants/cache-test/photoAssets/photo-a_thumb' }));
  await loadPhoto(uri, true);
  expect(getDoc).toHaveBeenCalledTimes(2);
});
it('allows retrying a failed read', async () => {
  const uri = 'firestore-photo:plants/retry-test/photoAssets/photo-a';
  jest.mocked(getDoc).mockRejectedValueOnce(new Error('Offline'));
  await expect(loadPhoto(uri)).rejects.toThrow('Offline');
  jest.mocked(getDoc).mockResolvedValueOnce({ data: () => ({ dataUri: 'data:image/jpeg;base64,AAAA' }) } as never);
  await expect(loadPhoto(uri)).resolves.toBe('data:image/jpeg;base64,AAAA');
});
