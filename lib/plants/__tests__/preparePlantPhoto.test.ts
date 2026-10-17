import { ImageManipulator } from 'expo-image-manipulator';
import { preparePlantPhoto, MAX_PHOTO_LENGTH, MAX_THUMBNAIL_LENGTH } from '../preparePlantPhoto';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
const save = jest.fn();
const release = jest.fn();
const context = { renderAsync: jest.fn(), reset: jest.fn(), resize: jest.fn(), release: jest.fn() };
beforeEach(() => {
  jest.mocked(ImageManipulator.manipulate).mockReturnValue(context as never);
  context.reset.mockReturnValue(context);
  context.resize.mockReturnValue(context);
  context.renderAsync.mockResolvedValue({ width: 3000, height: 4000, saveAsync: save, release });
  save.mockResolvedValue({ base64: 'AAAA' });
});
it('preserves portrait proportions, produces portable JPEGs and releases resources', async () => {
  const photo = await preparePlantPhoto('blob:chosen');
  expect(photo).toEqual({ image: 'data:image/jpeg;base64,AAAA', thumbnail: 'data:image/jpeg;base64,AAAA' });
  expect(context.resize.mock.calls).toEqual([[{ width: 720, height: 960 }], [{ width: 180, height: 240 }]]);
  expect(release).toHaveBeenCalledTimes(3);
  expect(context.release).toHaveBeenCalledTimes(1);
});
it('reduces dimensions again if the encoded image or thumbnail exceeds its limit', async () => {
  save.mockResolvedValueOnce({ base64: 'A'.repeat(MAX_PHOTO_LENGTH) }).mockResolvedValueOnce({ base64: 'AAAA' })
    .mockResolvedValueOnce({ base64: 'A'.repeat(MAX_THUMBNAIL_LENGTH) }).mockResolvedValueOnce({ base64: 'AAAA' });
  const photo = await preparePlantPhoto('blob:large');
  expect(photo.image.length).toBeLessThanOrEqual(MAX_PHOTO_LENGTH);
  expect(photo.thumbnail.length).toBeLessThanOrEqual(MAX_THUMBNAIL_LENGTH);
  expect(context.resize).toHaveBeenCalledTimes(4);
});
it('rejects a photo that cannot fit instead of sending an oversized database write', async () => {
  save.mockResolvedValue({ base64: 'A'.repeat(MAX_PHOTO_LENGTH) });
  await expect(preparePlantPhoto('blob:too-large')).rejects.toThrow('smaller photo');
  expect(context.release).toHaveBeenCalledTimes(1);
});
it('does not enlarge small images', async () => {
  context.renderAsync.mockResolvedValue({ width: 80, height: 60, saveAsync: save, release });
  await preparePlantPhoto('blob:small');
  expect(context.resize).toHaveBeenCalledWith({ width: 80, height: 60 });
});
it('releases resources when encoding fails', async () => {
  save.mockRejectedValueOnce(new Error('Unreadable image'));
  await expect(preparePlantPhoto('blob:broken')).rejects.toThrow('Unreadable image');
  expect(release).toHaveBeenCalledTimes(2);
  expect(context.release).toHaveBeenCalledTimes(1);
});
