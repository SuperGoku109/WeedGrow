import { runTransaction } from 'firebase/firestore';
import { preparePhotoRecord } from '@/lib/plants/photoRepository';
import { uploadProgressPic } from '../uploadProgressPic';
jest.mock('@/services/firebase', () => ({ db: {} }));
jest.mock('@/services/session', () => ({ requireUserId: () => 'owner' }));
jest.mock('@/lib/plants/photoRepository', () => ({ preparePhotoRecord: jest.fn() }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), doc: jest.fn((_db, ...parts) => ({ path: parts.join('/'), id: parts.at(-1) })), serverTimestamp: jest.fn(() => 'server-time'), Timestamp: { fromDate: (value: Date) => value }, runTransaction: jest.fn() }));
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

it('stores an older photo and its journal record on the same plant-local day', async () => {
  const set = jest.fn();
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async (ref: { path: string }) => ({ exists: () => ref.path === 'plants/p', data: () => ({ owners: ['owner'], locationTimeZone: 'Asia/Tokyo' }) }), set, update: jest.fn() } as never));
  await uploadProgressPic('p', 'test-image', 'Earlier growth', 'dated', undefined, '2026-01-02');
  const photo = set.mock.calls.find(call => call[0].path === 'plants/p/progressPics/dated')[1];
  const log = set.mock.calls.find(call => call[0].path === 'plants/p/logs/photo_dated')[1];
  expect(photo).toMatchObject({ calendarDay: '2026-01-02', timeZone: 'Asia/Tokyo', timestamp: new Date('2026-01-02T03:00:00Z') });
  expect(log.timestamp).toEqual(photo.timestamp); expect(log.calendarDay).toBe(photo.calendarDay);
});
it('rejects invalid and future photo dates before any transaction writes', async () => {
  const set = jest.fn(); const update = jest.fn();
  jest.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get: async (ref: { path: string }) => ({ exists: () => ref.path === 'plants/p', data: () => ({ owners: ['owner'] }) }), set, update } as never));
  await expect(uploadProgressPic('p', 'test-image', '', 'future', undefined, '9999-01-01')).rejects.toThrow('earlier');
  await expect(uploadProgressPic('p', 'test-image', '', 'invalid', undefined, '2026-02-31')).rejects.toThrow('calendar');
  expect(set).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
});
