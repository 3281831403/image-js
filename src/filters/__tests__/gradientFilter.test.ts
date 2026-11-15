import { expect, test } from 'vitest';

const kernelX = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 0],
];
const kernelY = [
  [1, 0, 0],
  [0, 0, 0],
  [0, 0, 1],
];

const image = testUtils.createGreyImage([
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
]);

test('gradientX', () => {
  const result = image.gradientFilter({
    kernelX,
    borderType: 'constant',
  });

  expect(result).toMatchImageData([
    [1, 1, 1],
    [1, 2, 2],
    [1, 2, 2],
  ]);
});

test('gradientY', () => {
  const result = image.gradientFilter({
    kernelY,
    borderType: 'constant',
  });

  expect(result).toMatchImageData([
    [1, 1, 0],
    [1, 2, 1],
    [0, 1, 1],
  ]);
});

test('gradientX and gradientY', () => {
  const result = image.gradientFilter({
    kernelX,
    kernelY,
    borderType: 'constant',
  });

  expect(result).toMatchImageData([
    [1, 1, 1],
    [1, 2, 2],
    [1, 2, 2],
  ]);
});

test('gradientX and gradientY saturate instead of wrapping', () => {
  const image = testUtils.createGreyImage([
    [200, 200, 200],
    [200, 200, 200],
    [200, 200, 200],
  ]);

  const result = image.derivativeFilter({ borderType: 'constant' });

  expect(result.bitDepth).toBe(8);
  expect(result).toMatchImageData([
    [255, 255, 255],
    [255, 0, 255],
    [255, 255, 255],
  ]);
});

test('bitDepth 16 for gradientX and gradientY', () => {
  const image = testUtils.createGreyImage([
    [200, 200, 200],
    [200, 200, 200],
    [200, 200, 200],
  ]);

  const result = image.derivativeFilter({
    borderType: 'constant',
    bitDepth: 16,
  });

  expect(result.bitDepth).toBe(16);
  expect(result).toMatchImageData([
    [848, 800, 848],
    [800, 0, 800],
    [848, 800, 848],
  ]);
});

test('16-bit gradient saturates at 65535', () => {
  const image = testUtils.createGreyImage(
    [
      [65535, 65535, 65535],
      [65535, 65535, 65535],
      [65535, 65535, 65535],
    ],
    { bitDepth: 16 },
  );

  const result = image.derivativeFilter({ borderType: 'constant' });

  expect(result.bitDepth).toBe(16);
  expect(result).toMatchImageData([
    [65535, 65535, 65535],
    [65535, 0, 65535],
    [65535, 65535, 65535],
  ]);
});

test('bitDepth 16 for gradientX only', () => {
  const image = testUtils.createGreyImage([
    [200, 200, 200],
    [200, 200, 200],
    [200, 200, 200],
  ]);
  const kernel = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 1],
  ];

  const result = image.gradientFilter({
    kernelX: kernel,
    borderType: 'constant',
    bitDepth: 16,
  });

  expect(result.bitDepth).toBe(16);
  expect(result).toMatchImageData([
    [200, 200, 0],
    [200, 200, 0],
    [0, 0, 0],
  ]);
});

test('bitDepth 16 for gradientY only', () => {
  const image = testUtils.createGreyImage([
    [200, 200, 200],
    [200, 200, 200],
    [200, 200, 200],
  ]);
  const kernel = [
    [0, 0, 0],
    [0, 0, 0],
    [1, 0, 0],
  ];

  const result = image.gradientFilter({
    kernelY: kernel,
    borderType: 'constant',
    bitDepth: 16,
  });

  expect(result.bitDepth).toBe(16);
  expect(result).toMatchImageData([
    [0, 200, 200],
    [0, 200, 200],
    [0, 0, 0],
  ]);
});

test('16-bit image can be converted to an 8-bit gradient', () => {
  const image = testUtils.createGreyImage(
    [
      [65535, 65535, 65535],
      [65535, 65535, 65535],
      [65535, 65535, 65535],
    ],
    { bitDepth: 16 },
  );

  const result = image.derivativeFilter({
    borderType: 'constant',
    bitDepth: 8,
  });

  expect(result.bitDepth).toBe(8);
  expect(result).toMatchImageData([
    [255, 255, 255],
    [255, 0, 255],
    [255, 255, 255],
  ]);
});

test('unsupported bitDepth', () => {
  expect(() =>
    image.gradientFilter({
      kernelX,
      kernelY,
      // @ts-expect-error: testing an invalid value
      bitDepth: 4,
    }),
  ).toThrow('This image bit depth is not supported: 4');
});
