export type ImageFrame = { x: number; y: number; width: number; height: number };
export const PLANT_ENTRANCE_MS = 560;
export const ANDROID_PLANT_ENTRANCE_MS = 420;
export const plantEntrance = { photoEnd: 0.78, chromeStart: 0.32, chromeEnd: 0.7, handoffStart: 0.64, handoffEnd: 0.84, contentStart: 0.7 } as const;
export const androidPlantEntrance = {
  photoEnd: 0.91,
  backdropStart: 0.04,
  backdropEnd: 0.36,
  chromeStart: 0.31,
  chromeEnd: 0.68,
  handoffStart: 0.77,
  handoffEnd: 0.98,
  titleStart: 0.73,
  titleEnd: 0.95,
} as const;
export function entrancePhase(time: number, start: number, end: number) {
  'worklet';
  return Math.max(0, Math.min(1, (time - start) / (end - start)));
}
export function photoProgress(time: number, android = false) {
  'worklet';
  const remaining = 1 - entrancePhase(time, 0, android ? androidPlantEntrance.photoEnd : plantEntrance.photoEnd);
  if (android) return 1 - remaining * remaining * remaining;
  return 1 - remaining * remaining * remaining * remaining;
}
/** Cover fit stays uniform while the viewport changes aspect ratio. */
export function coverTransform(source: ImageFrame, target: ImageFrame, image: { width: number; height: number }, p: number, layout = target) {
  'worklet';
  const width = source.width + (target.width - source.width) * p;
  const height = source.height + (target.height - source.height) * p;
  const scaleX = width / layout.width;
  const scaleY = height / layout.height;
  const cover = Math.max(width / image.width, height / image.height);
  return {
    translateX: source.x + (target.x - source.x) * p + (width - layout.width) / 2,
    translateY: source.y + (target.y - source.y) * p + (height - layout.height) / 2,
    scaleX, scaleY, imageScaleX: cover / scaleX, imageScaleY: cover / scaleY,
  };
}
