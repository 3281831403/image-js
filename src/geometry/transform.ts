import { Matrix, inverse } from 'ml-matrix';

import type { Image } from '../Image.ts';
import { Mask } from '../Mask.ts';
import { getClamp } from '../utils/clamp.ts';
import { getDefaultColor } from '../utils/getDefaultColor.ts';
import type { OutOptions } from '../utils/getOutputImage.ts';
import {
  getOutputImage,
  maskToOutputMask,
} from '../utils/getOutputImage.ts';
import type { BorderType } from '../utils/interpolateBorder.ts';
import { getBorderInterpolation } from '../utils/interpolateBorder.ts';
import type { InterpolationType } from '../utils/interpolatePixel.ts';
import { getInterpolationFunction } from '../utils/interpolatePixel.ts';
import { validateColor } from '../utils/validators/validators.ts';

export interface TransformOptions extends OutOptions {
  /**
   * Width of the output image.
   */
  width?: number;
  /**
   * Height of the output image.
   */
  height?: number;
  /**
   * Method to use to interpolate the new pixels.
   * Masks only support `'nearest'`.
   * @default `'bilinear'`
   */

  interpolationType?: InterpolationType;
  /**
   * Specify how the borders should be handled.
   * @default `'constant'`
   */
  borderType?: BorderType;
  /**
   * Value of the border if BorderType is 'constant'.
   *  @default `0`
   */
  borderValue?: number | number[];
  /**
   * Whether the transform matrix should be inverted.
   */
  inverse?: boolean;
  /**
   * Bypasses width and height options to include
   * every pixel of the original image inside the transformed image.
   */
  fullImage?: boolean;
}

/**
 * Transforms an image using a matrix.
 * @param image - Original image.
 * @param transformMatrix - 2×3 transform matrix.
 * @param options - Transform options.
 * @returns The new image.
 */
export function transform(
  image: Image,
  transformMatrix: number[][],
  options?: TransformOptions,
): Image;
export function transform(
  image: Mask,
  transformMatrix: number[][],
  options?: TransformOptions,
): Mask;
export function transform(
  image: Image | Mask,
  transformMatrix: number[][],
  options?: TransformOptions,
): Image | Mask;
export function transform(
  image: Image | Mask,
  transformMatrix: number[][],
  options: TransformOptions = {},
): Image | Mask {
  const {
    borderValue = image instanceof Mask ? 0 : getDefaultColor(image),
    borderType = 'constant',
    interpolationType = 'bilinear',
    fullImage,
  } = options;
  let { width = image.width, height = image.height } = options;

  if (image instanceof Mask && interpolationType !== 'nearest') {
    throw new RangeError(
      `invalid interpolationType: ${interpolationType}. Masks only support nearest interpolation.`,
    );
  }

  if (Array.isArray(borderValue)) {
    validateColor(borderValue, image);
  }

  if (!isValidMatrix(transformMatrix)) {
    throw new TypeError(
      `transformation matrix must be 2x3 or 3x3. Received ${transformMatrix.length}x${transformMatrix[1].length}`,
    );
  }

  // Copy the matrix so that the user's array is never mutated.
  let matrix = transformMatrix.map((row) => row.slice());
  if (matrix.length === 2) {
    matrix.push([0, 0, 1]);
  }

  if (fullImage) {
    matrix[0][2] = 0;
    matrix[1][2] = 0;
    const corners = [
      { column: 0, row: 0 },
      { column: image.width, row: 0 },
      { column: image.width, row: image.height },
      { column: 0, row: image.height },
    ];

    const transformedCorners = corners.map((corner) => {
      return [
        transformPoint(matrix[0], matrix[2], corner.column, corner.row),
        transformPoint(matrix[1], matrix[2], corner.column, corner.row),
      ];
    });

    const xCoordinates = transformedCorners.map((c) => c[0]);
    const yCoordinates = transformedCorners.map((c) => c[1]);
    const maxX = Math.max(...xCoordinates);
    const maxY = Math.max(...yCoordinates);
    const minX = Math.min(...xCoordinates);
    const minY = Math.min(...yCoordinates);
    const center = [(image.width - 1) / 2, (image.height - 1) / 2];

    width = maxX - minX;
    height = maxY - minY;

    const centerX = transformPoint(matrix[0], matrix[2], center[0], center[1]);
    const centerY = transformPoint(matrix[1], matrix[2], center[0], center[1]);
    const a = (width - 1) / 2 - centerX;
    const b = (height - 1) / 2 - centerY;
    matrix[0][2] = a;
    matrix[1][2] = b;
    width = Math.round(width);
    height = Math.round(height);
  }

  if (!options.inverse) {
    matrix = inverse(new Matrix(matrix)).to2DArray();
  }

  const newParameters = { width, height };
  const newImage =
    image instanceof Mask
      ? maskToOutputMask(image, options, { newParameters })
      : getOutputImage(image, options, { newParameters });

  const interpolateBorder = getBorderInterpolation(borderType, borderValue);
  const clamp = getClamp(newImage);

  const interpolate = getInterpolationFunction(interpolationType);
  for (let row = 0; row < newImage.height; row++) {
    for (let column = 0; column < newImage.width; column++) {
      const nx = transformPoint(matrix[0], matrix[2], column, row);
      const ny = transformPoint(matrix[1], matrix[2], column, row);
      for (let channel = 0; channel < newImage.channels; channel++) {
        const newValue = interpolate(
          image,
          nx,
          ny,
          channel,
          interpolateBorder,
          clamp,
        );
        // Mask.setValue only accepts bits, but nearest interpolation of a
        // mask can only yield 0 or 1, so the cast is safe.
        (newImage as Image).setValue(column, row, channel, newValue);
      }
    }
  }

  return newImage;
}

/**
 * Apply a transformation to a point.
 * @param transform - Transformation matrix.
 * @param perspective - Perspective matrix.
 * @param column - Column of the point.
 * @param row - Row of the point.
 * @returns New value.
 */
function transformPoint(
  transform: number[],
  perspective: number[],
  column: number,
  row: number,
): number {
  return (
    (transform[0] * column + transform[1] * row + transform[2]) /
    (perspective[0] * column + perspective[1] * row + perspective[2])
  );
}

function isValidMatrix(transformationMatrix: number[][]) {
  return (
    (transformationMatrix.length === 3 &&
      transformationMatrix[0].length === 3 &&
      transformationMatrix[1].length === 3 &&
      transformationMatrix[2].length === 3) ||
    (transformationMatrix.length === 2 &&
      transformationMatrix[0].length === 3 &&
      transformationMatrix[1].length === 3)
  );
}
