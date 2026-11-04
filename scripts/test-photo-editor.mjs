import assert from 'node:assert/strict';
import { test } from 'node:test';
import { centeredCrop, moveCrop, resizeCrop, zoomCrop, encodeSmallestPhoto } from '../utils/photo-editor.ts';

function withinImage(crop) {
  assert.ok(crop.width > 0 && crop.height > 0);
  assert.ok(crop.x >= -1e-10 && crop.y >= -1e-10);
  assert.ok(crop.x + crop.width <= 1 + 1e-10 && crop.y + crop.height <= 1 + 1e-10);
}

test('crop gestures stay within portrait, landscape and panorama images', () => {
  for (const imageAspect of [0.01, 0.5, 1, 4 / 3, 2, 100]) {
    for (const outputAspect of [0.5, 1, 4 / 3, 16 / 9]) {
      const crop = centeredCrop(imageAspect, outputAspect);
      withinImage(crop);
      assert.ok(Math.abs(crop.width / crop.height * imageAspect - outputAspect) < 1e-8);
      for (const corner of ['nw', 'ne', 'sw', 'se']) {
        for (const delta of [-2, -0.5, -0.01, 0, 0.01, 0.5, 2]) {
          withinImage(resizeCrop(crop, corner, delta, -delta));
          const fixed = resizeCrop(crop, corner, delta, -delta, outputAspect / imageAspect);
          withinImage(fixed);
          assert.ok(Math.abs(fixed.width / fixed.height * imageAspect - outputAspect) < 1e-8);
          withinImage(moveCrop(crop, delta, -delta));
          withinImage(zoomCrop(crop, Math.exp(delta * 4), { x: 0.2, y: 0.7 }, { x: delta, y: -delta }));
        }
      }
    }
  }
});

test('corner resize keeps opposite corner anchored and freeform changes aspect', () => {
  const crop = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
  const resized = resizeCrop(crop, 'nw', 0.1, 0.2);
  assert.ok(Math.abs(resized.x + resized.width - 0.8) < 1e-10);
  assert.ok(Math.abs(resized.y + resized.height - 0.8) < 1e-10);
  assert.notEqual(resized.width, resized.height);
});

test('preview pinch zoom preserves the focal point before boundary clamping', () => {
  const crop = { x: 0.1, y: 0.2, width: 0.6, height: 0.6 };
  const focal = { x: 0.3, y: 0.4 };
  const zoomed = zoomCrop(crop, 0.5, focal, focal);
  assert.ok(Math.abs((focal.x - zoomed.x) / zoomed.width - (focal.x - crop.x) / crop.width) < 1e-10);
  assert.ok(Math.abs((focal.y - zoomed.y) / zoomed.height - (focal.y - crop.y) / crop.height) < 1e-10);
});

function encoder(responses) {
  return { toBlob(callback, mime, quality) {
    assert.equal(quality, 0.72);
    const response = responses[mime];
    if (response instanceof Error) throw response;
    callback(response);
  } };
}
const blob = (type, size) => new Blob([new Uint8Array(size)], { type });

test('export picks actual smallest encoded file, even when JPEG beats WebP', async () => {
  for (const [webpSize, jpegSize, expected] of [[50, 100, 'image/webp'], [100, 50, 'image/jpeg']]) {
    const result = await encodeSmallestPhoto(encoder({ 'image/webp': blob('image/webp', webpSize), 'image/jpeg': blob('image/jpeg', jpegSize) }));
    assert.equal(result.type, expected);
    assert.equal(result.size, 50);
  }
});

test('unsupported WebP silently returning PNG, null or throwing still produces JPEG', async () => {
  for (const response of [blob('image/png', 10), null, new Error('unsupported'), blob('image/webp', 0)]) {
    const result = await encodeSmallestPhoto(encoder({ 'image/webp': response, 'image/jpeg': blob('image/jpeg', 100) }));
    assert.equal(result.type, 'image/jpeg');
  }
});

test('export reports failure rather than downloading PNG with the wrong extension', async () => {
  await assert.rejects(encodeSmallestPhoto(encoder({ 'image/webp': blob('image/png', 10), 'image/jpeg': null })), /无法生成/);
});
