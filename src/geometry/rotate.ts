import type { Image } from '../Image.ts';
import { Mask } from '../Mask.ts';
import type { OutOptions } from '../utils/getOutputImage.ts';
import {
  getOutputImage,
  maskToOutputMask,
} from '../utils/getOutputImage.ts';
import type { InterpolationType } from '../utils/interpolatePixel.ts';

import { transform } from './transform.ts';

export interface RotateOptions extends OutOptions {
  /**
   * Method to use to interpolate the new pixels.
   * Masks only support `'nearest'`.
   * @default `'bilinear'` for images, `'nearest'` for masks.
   */
  interpolationType?: InterpolationType;
  /**
   * Value of the pixels that fall outside of the original image.
   * @default Transparent for images with an alpha channel, black otherwise.
   */
  borderValue?: number | number[];
}

/**
 * Rotates an image by any angle.
 * The rotation is done around the center of the image and the canvas is
 * expanded so that the whole rotated image fits in it.
 * Angles that are multiples of 90 degrees (after normalization) use an exact
 * pixel mapping and are not interpolated.
 * @param image - The image to rotate.
 * @param angle - The angle to rotate the image by, in degrees. Positive values rotate clockwise, negative values rotate counter-clockwise.
 * @param options - Rotate options.
 * @returns - The rotated image.
 */
export function rotate(
  image: Image,
  angle: number,
  options?: RotateOptions,
): Image;
export function rotate(
  image: Mask,
  angle: number,
  options?: RotateOptions,
): Mask;
export function rotate(
  image: Image | Mask,
  angle: number,
  options: RotateOptions = {},
): Image | Mask {
  const normalizedAngle = ((angle % 360) + 360) % 360;

  if (normalizedAngle % 90 === 0) {
    return rotateRightAngle(image, normalizedAngle, options);
  }

  const {
    interpolationType = image instanceof Mask ? 'nearest' : 'bilinear',
    borderValue = new Array(image.channels).fill(0),
    out,
  } = options;

  const angleRadians = (normalizedAngle * Math.PI) / 180;
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  // Clockwise rotation. The translation is computed by the fullImage option
  // so that the image rotates around its center and the canvas fits the
  // whole rotated image.
  const transformMatrix = [
    [cos, -sin, 0],
    [sin, cos, 0],
  ];

  return transform(image, transformMatrix, {
    fullImage: true,
    interpolationType,
    borderValue,
    out,
  });
}

/**
 * Rotate an image by a multiple of 90 degrees using an exact pixel mapping.
 * @param image - The image to rotate.
 * @param angle - Angle in degrees, normalized to [0, 360).
 * @param options - Rotate options.
 * @returns The rotated image.
 */
function rotateRightAngle(
  image: Image | Mask,
  angle: number,
  options: RotateOptions,
): Image | Mask {
  if (angle === 0) {
    return image instanceof Mask
      ? maskToOutputMask(image, options, { clone: true })
      : getOutputImage(image, options, { clone: true });
  }

  const newWidth = angle % 180 === 0 ? image.width : image.height;
  const newHeight = angle % 180 === 0 ? image.height : image.width;
  const newParameters = { width: newWidth, height: newHeight };
  const newImage =
    image instanceof Mask
      ? maskToOutputMask(image, options, { newParameters })
      : getOutputImage(image, options, { newParameters });

  if (angle === 90) {
    for (let column = 0; column < image.width; column++) {
      for (let row = 0; row < image.height; row++) {
        for (let channel = 0; channel < image.channels; channel++) {
          (newImage as Image).setValue(
            newImage.width - row - 1,
            column,
            channel,
            image.getValue(column, row, channel),
          );
        }
      }
    }
  } else if (angle === 180) {
    for (let column = 0; column < image.width; column++) {
      for (let row = 0; row < image.height; row++) {
        for (let channel = 0; channel < image.channels; channel++) {
          (newImage as Image).setValue(
            newImage.width - column - 1,
            newImage.height - row - 1,
            channel,
            image.getValue(column, row, channel),
          );
        }
      }
    }
  } else {
    for (let column = 0; column < image.width; column++) {
      for (let row = 0; row < image.height; row++) {
        for (let channel = 0; channel < image.channels; channel++) {
          (newImage as Image).setValue(
            row,
            newImage.height - column - 1,
            channel,
            image.getValue(column, row, channel),
          );
        }
      }
    }
  }

  return newImage;
}
