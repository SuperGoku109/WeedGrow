import { coverTransform, entrancePhase, plantEntrance, type ImageFrame } from '../plantEntrance';
const source: ImageFrame = { x: 22, y: 310, width: 146, height: 112 };
const target: ImageFrame = { x: 19, y: 57, width: 318, height: 174 };
const image = { width: 1200, height: 1600 };

it('matches both measured viewports exactly without stretching the photo', () => {
  for (const p of [0, 0.2, 0.5, 0.8, 1]) {
    const result = coverTransform(source, target, image, p);
    const width = source.width + (target.width - source.width) * p;
    const height = source.height + (target.height - source.height) * p;
    expect(result.scaleX * target.width).toBeCloseTo(width);
    expect(result.scaleY * target.height).toBeCloseTo(height);
    expect(result.translateX + (target.width - width) / 2).toBeCloseTo(source.x + (target.x - source.x) * p);
    expect(result.translateY + (target.height - height) / 2).toBeCloseTo(source.y + (target.y - source.y) * p);
    const renderedScaleX = result.imageScaleX * result.scaleX;
    const renderedScaleY = result.imageScaleY * result.scaleY;
    expect(renderedScaleX).toBeCloseTo(renderedScaleY);
    expect(image.width * renderedScaleX).toBeGreaterThanOrEqual(width - 0.001);
    expect(image.height * renderedScaleY).toBeGreaterThanOrEqual(height - 0.001);
  }
});

it('overlaps chrome and the photo handoff, then admits content before completion', () => {
  expect(plantEntrance.chromeStart).toBeLessThan(plantEntrance.photoEnd);
  expect(plantEntrance.chromeEnd).toBeLessThan(plantEntrance.handoffEnd);
  expect(plantEntrance.handoffStart).toBeLessThan(plantEntrance.photoEnd);
  expect(plantEntrance.contentStart).toBeLessThan(1);
  expect(entrancePhase(-1, 0.3, 0.7)).toBe(0);
  expect(entrancePhase(2, 0.3, 0.7)).toBe(1);
});

it('keeps the first frame fixed when Android receives the destination size', () => {
  const atSource = coverTransform(source, source, image, 0, source);
  expect(coverTransform(source, target, image, 0, source)).toEqual(atSource);
  const atTarget = coverTransform(source, target, image, 1, source);
  expect(atTarget.scaleX * source.width).toBeCloseTo(target.width);
  expect(atTarget.scaleY * source.height).toBeCloseTo(target.height);
  expect(atTarget.translateX + (source.width - target.width) / 2).toBeCloseTo(target.x);
  expect(atTarget.translateY + (source.height - target.height) / 2).toBeCloseTo(target.y);
});
