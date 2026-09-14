import { uploadPlantImageUri } from '@/lib/plants/plantImages';
import { getDownloadURL, uploadBytesResumable } from 'firebase/storage';

jest.mock('@/services/firebase', () => ({ db: {}, storage: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), serverTimestamp: jest.fn(), updateDoc: jest.fn() }));
jest.mock('firebase/storage', () => ({ ref: jest.fn(() => 'storage-ref'), uploadBytesResumable: jest.fn(), getDownloadURL: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, blob: async () => ({}) } as Response);
  jest.mocked(getDownloadURL).mockResolvedValue('https://example.com/plant.jpg');
});
afterEach(() => jest.useRealTimers());

it('returns the durable URL after uploading a selected photo', async () => {
  const task = Object.assign(Promise.resolve(), { cancel: jest.fn() });
  jest.mocked(uploadBytesResumable).mockReturnValue(task as never);
  await expect(uploadPlantImageUri('plant-a', 'blob:photo')).resolves.toBe('https://example.com/plant.jpg');
  expect(task.cancel).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('cancels a stalled upload after 25 seconds instead of hanging the flow', async () => {
  let rejectUpload: (error: Error) => void = () => {};
  const pending = new Promise((_resolve, reject) => { rejectUpload = reject; });
  const cancel = jest.fn(() => rejectUpload(new Error('Upload cancelled')));
  jest.mocked(uploadBytesResumable).mockReturnValue(Object.assign(pending, { cancel }) as never);
  const outcome = expect(uploadPlantImageUri('plant-a', 'blob:photo')).rejects.toThrow('Upload cancelled');
  await jest.advanceTimersByTimeAsync(25000);
  await outcome;
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(getDownloadURL).not.toHaveBeenCalled();
});

it('reuses a hosted cover without uploading it again', async () => {
  await expect(uploadPlantImageUri('plant-a', 'https://example.com/plant.jpg')).resolves.toBe('https://example.com/plant.jpg');
  expect(uploadBytesResumable).not.toHaveBeenCalled();
});
