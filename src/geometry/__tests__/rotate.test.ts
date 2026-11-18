import { expect, test } from 'vitest';

import { Image } from '../../Image.ts';
import { Mask } from '../../Mask.ts';

const image = testUtils.createGreyImage(`
 1 2 3
 4 5 6
`);

/**
 * Reference implementation: the exact pixel mapping that was used when
 * only multiples of 90 degrees were supported.
 * @param source - The image to rotate.
 * @param angle - The angle to rotate the image by.
 * @returns The rotated image.
 */
function legacyRotate(source: Image, angle: number): Image {
  const newWidth = angle % 180 === 0 ? source.width : source.height;
  const newHeight = angle % 180 === 0 ? source.height : source.width;
  const result = Image.createFrom(source, {
    width: newWidth,
    height: newHeight,
  });

  if (angle === 90 || angle === -270) {
    for (let column = 0; column < source.width; column++) {
      for (let row = 0; row < source.height; row++) {
        for (let channel = 0; channel < source.channels; channel++) {
          result.setValue(
            result.width - row - 1,
            column,
            channel,
            source.getValue(column, row, channel),
          );
        }
      }
    }
  } else if (angle === 180 || angle === -180) {
    for (let column = 0; column < source.width; column++) {
      for (let row = 0; row < source.height; row++) {
        for (let channel = 0; channel < source.channels; channel++) {
          result.setValue(
            result.width - column - 1,
            result.height - row - 1,
            channel,
            source.getValue(column, row, channel),
          );
        }
      }
    }
  } else {
    for (let column = 0; column < source.width; column++) {
      for (let row = 0; row < source.height; row++) {
        for (let channel = 0; channel < source.channels; channel++) {
          result.setValue(
            row,
            result.height - column - 1,
            channel,
            source.getValue(column, row, channel),
          );
        }
      }
    }
  }
  return result;
}


test('rotate by 90 degrees', () => {
  const rotated = image.rotate(90);

  expect(rotated).toMatchImageData(`
   4 1
   5 2
   6 3
  `);
});

test('rotate by 180 degrees', () => {
  const rotated = image.rotate(180);

  expect(rotated).toMatchImageData(`
   6 5 4
   3 2 1
  `);
});

test('rotate by 270 degrees', () => {
  const rotated = image.rotate(270);

  expect(rotated).toMatchImageData(`
   3 6
   2 5
   1 4
  `);
});

test('with an rgb image', () => {
  const image = testUtils.createRgbImage(`
   1 2 3 | 4 5 6
   7 8 9 | 10 11 12
  `);

  const rotated = image.rotate(90);

  expect(rotated).toMatchImageData(`
    7 8 9 | 1 2 3
    10 11 12 | 4 5 6
  `);
});

test('rotate by 0 degrees returns an exact copy', () => {
  const rotated = image.rotate(0);

  expect(rotated).not.toBe(image);
  expect(rotated).toMatchImage(image);
});

test('rotate by 360 degrees returns an exact copy', () => {
  const rotated = image.rotate(360);

  expect(rotated).toMatchImage(image);
});

test('negative multiples of 90 are normalized and exact', () => {
  expect(image.rotate(-90)).toMatchImage(image.rotate(270));
  expect(image.rotate(-180)).toMatchImage(image.rotate(180));
  expect(image.rotate(-270)).toMatchImage(image.rotate(90));
  expect(image.rotate(-360)).toMatchImage(image);
});

test('multiples of 90 match the legacy pixel mapping pixel by pixel', () => {
  const images = [
    testUtils.createGreyImage(`
      1 2 3
      4 5 6
    `),
    testUtils.createRgbImage(`
      1 2 3 | 4 5 6
      7 8 9 | 10 11 12
    `),
    testUtils.createRgbaImage(`
      1 2 3 4 | 5 6 7 8
      9 10 11 12 | 13 14 15 16
    `),
  ];

  const rightAngles = [90, 180, 270, -90, -180, -270];
  for (const angle of rightAngles) {
    for (const img of images) {
      expect(img.rotate(angle)).toMatchImage(legacyRotate(img, angle));
    }
  }

  const copyAngles = [0, 360, -360, 720];
  for (const angle of copyAngles) {
    for (const img of images) {
      expect(img.rotate(angle)).toMatchImage(img);
    }
  }
});

test('angles larger than 360 are normalized and exact', () => {
  expect(image.rotate(450)).toMatchImage(image.rotate(90));
  expect(image.rotate(720)).toMatchImage(image);
});

test('multiples of 90 are not interpolated', () => {
  // A checkerboard would be blurred by any interpolation.
  const checkerboard = testUtils.createGreyImage(`
    0 255 0 255
    255 0 255 0
    0 255 0 255
  `);

  const rotated = checkerboard.rotate(90);

  expect(rotated).toMatchImageData(`
    0 255 0
    255 0 255
    0 255 0
    255 0 255
  `);
});

test('rotate by 45 degrees expands the canvas and rotates clockwise', () => {
  const image = testUtils.createGreyImage(`1 2`);

  const rotated = image.rotate(45);

  expect(rotated.width).toBe(2);
  expect(rotated.height).toBe(2);
  // The right pixel moves down: the rotation is clockwise.
  expect(rotated).toMatchImageData(`
    1 0
    0 2
  `);
});

test('arbitrary angles rotate around the image center', () => {
  const image = testUtils.createGreyImage(`
    0 0 0 0 0
    0 0 0 0 0
    0 0 255 0 0
    0 0 0 0 0
    0 0 0 0 0
  `);

  const rotated = image.rotate(30, { interpolationType: 'nearest' });

  expect(rotated.width).toBe(7);
  expect(rotated.height).toBe(7);
  // The center pixel does not move.
  expect(rotated.getValue(3, 3, 0)).toBe(255);
  expect(rotated.getValue(0, 0, 0)).toBe(0);
});

test('default interpolation is bilinear', () => {
  const image = testUtils.createGreyImage(`
    0 0 0
    0 255 0
    0 0 0
  `);

  const rotated = image.rotate(45);

  // Bilinear interpolation spreads the center pixel over its neighbors.
  expect(rotated.getValue(2, 2, 0)).toBeGreaterThan(0);
  expect(rotated.getValue(2, 2, 0)).toBeLessThan(255);

  const nearest = image.rotate(45, { interpolationType: 'nearest' });
  for (let index = 0; index < nearest.size; index++) {
    expect([0, 255]).toContain(nearest.getValueByIndex(index, 0));
  }
});

test('empty areas of rotated RGBA image are transparent', () => {
  const image = testUtils.createRgbaImage(`
    100 150 200 255 | 100 150 200 255 | 100 150 200 255 | 100 150 200 255
    100 150 200 255 | 100 150 200 255 | 100 150 200 255 | 100 150 200 255
    100 150 200 255 | 100 150 200 255 | 100 150 200 255 | 100 150 200 255
    100 150 200 255 | 100 150 200 255 | 100 150 200 255 | 100 150 200 255
  `);

  const rotated = image.rotate(45);

  expect(rotated.width).toBe(6);
  expect(rotated.height).toBe(6);
  // Corners are fully outside of the original image: transparent, not black.
  expect(rotated.getPixel(0, 0)).toStrictEqual([0, 0, 0, 0]);
  expect(rotated.getPixel(5, 5)).toStrictEqual([0, 0, 0, 0]);
  // The center of the image is still opaque.
  expect(rotated.getPixel(3, 3)[3]).toBe(255);
});

test('custom borderValue is used for empty areas', () => {
  const image = testUtils.createGreyImage(`
    0 0 0 0
    0 0 0 0
    0 0 0 0
    0 0 0 0
  `);

  const rotated = image.rotate(45, { borderValue: 100 });

  expect(rotated.getValue(0, 0, 0)).toBe(100);
});

test('out option for images', () => {
  const out = new Image(3, 2, { colorModel: 'GREY' });

  const result = image.rotate(180, { out });

  expect(result).toBe(out);
  expect(out).toMatchImageData(`
    6 5 4
    3 2 1
  `);
});

test('out option with arbitrary angle', () => {
  const rotated = image.rotate(45);
  const out = new Image(rotated.width, rotated.height, {
    colorModel: 'GREY',
  });

  const result = image.rotate(45, { out });

  expect(result).toBe(out);
  expect(out).toMatchImage(rotated);
});

test('out with wrong size or type throws a RangeError', () => {
  const wrongSize = new Image(2, 2, { colorModel: 'GREY' });

  expect(() => image.rotate(90, { out: wrongSize })).toThrow(RangeError);

  const wrongColorModel = new Image(3, 2, { colorModel: 'RGB' });

  expect(() => image.rotate(180, { out: wrongColorModel })).toThrow(RangeError);

  const notAnImage = new Mask(3, 2);

  expect(() =>
    image.rotate(180, { out: notAnImage as unknown as Image }),
  ).toThrow(RangeError);
});

test('rotate a mask by 90 degrees', () => {
  const mask = testUtils.createMask(`
    1 0 0
    0 1 1
  `);

  const rotated = mask.rotate(90);

  expect(rotated).toBeInstanceOf(Mask);
  expect(rotated).toMatchMaskData(`
    0 1
    1 0
    1 0
  `);
});

test('rotate a mask by an arbitrary angle', () => {
  const mask = testUtils.createMask(`
    0 0 0
    0 1 1
    0 1 1
  `);

  const rotated = mask.rotate(45);

  expect(rotated).toBeInstanceOf(Mask);
  expect(rotated.width).toBe(4);
  expect(rotated.height).toBe(4);
  expect(rotated.getBit(2, 2)).toBe(1);
  expect(rotated.getNbNonZeroPixels()).toBeGreaterThan(0);
});

test('masks only support nearest interpolation', () => {
  const mask = testUtils.createMask(`
    0 0 0
    0 1 0
    0 0 0
  `);

  expect(() => mask.rotate(45, { interpolationType: 'bilinear' })).toThrow(
    RangeError,
  );
  expect(() => mask.rotate(45, { interpolationType: 'bicubic' })).toThrow(
    RangeError,
  );
});

test('out option for masks', () => {
  const mask = testUtils.createMask(`
    1 0 0
    0 1 1
  `);
  const out = new Mask(2, 3);

  const result = mask.rotate(90, { out });

  expect(result).toBe(out);
  expect(out).toMatchMaskData(`
    0 1
    1 0
    1 0
  `);
});

test('out with wrong size or type throws a RangeError for masks', () => {
  const mask = testUtils.createMask(`
    1 0 0
    0 1 1
  `);

  const wrongSize = new Mask(3, 3);

  expect(() => mask.rotate(90, { out: wrongSize })).toThrow(RangeError);

  const notAMask = new Image(2, 3, { colorModel: 'GREY' });

  expect(() =>
    mask.rotate(90, { out: notAMask as unknown as Mask }),
  ).toThrow(RangeError);
});
