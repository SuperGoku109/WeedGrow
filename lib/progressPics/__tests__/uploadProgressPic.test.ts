import { runTransaction } from 'firebase/firestore';
import { preparePhotoRecord } from '@/lib/plants/photoRepository';
import { uploadProgressPic } from '../uploadProgressPic';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('@/lib/plants/photoRepository', () => ({ preparePhotoRecord: jest.fn() }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn((_db, ...parts) => ({ path: parts.join('/'), id: parts.at(-1) })), serverTimestamp: jest.fn(() => 'server-time'), runTransaction: jest.fn() }));
beforeEach(() => {
  jest.mocked(preparePhotoRecord).mockResolvedValue({ uri: 'firestore-photo:plants/p/photoAssets/image', writes: [] });
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async (ref: { path: string }) => ({ exists: () => ref.path === 'plants/p', data: () => ({ owners: ['owner'] }) }), set: jest.fn(), update: jest.fn() } as never));
});
it('reports completed upload only after the atomic save succeeds', async () => {
  const progress = jest.fn();
  await uploadProgressPic('p', 'test-image', 'Caption', 'stable-retry', progress);
  expect(progress.mock.calls.map(call => call[0])).toEqual(['preparing', 'saving', 'complete']);
});
it('does not report a successful upload when the save fails', async () => {
  const progress = jest.fn(); jest.mocked(runTransaction).mockRejectedValueOnce(new Error('Offline'));
  await expect(uploadProgressPic('p', 'test-image', 'Caption', 'stable-retry', progress)).rejects.toThrow('Offline');
  expect(progress.mock.calls.map(call => call[0])).toEqual(['preparing', 'saving']);
});
