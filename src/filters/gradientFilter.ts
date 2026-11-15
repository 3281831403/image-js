import type { BitDepth } from '../Image.ts';
import { Image } from '../Image.ts';
import { getClamp } from '../utils/clamp.ts';
import type { BorderType } from '../utils/interpolateBorder.ts';
import { round } from '../utils/round.ts';
import checkProcessable from '../utils/validators/checkProcessable.ts';

export interface GradientFilterBaseOptions {
  /**
   * Specify how the borders should be handled.
   * @default `'replicate'`
   */
  borderType?: BorderType;
  /**
   * Value of the border if BorderType is 'constant'.
   * @default `0`
   */
  borderValue?: number;
  /**
   * Specify the bit depth of the resulting image.
   * @default `image.bitDepth`
   */
  bitDepth?: BitDepth;
}

export interface GradientFilterXOptions extends GradientFilterBaseOptions {
  /**
   * Kernel along x axis.
   */
  kernelX: number[][];
}
export interface GradientFilterYOptions extends GradientFilterBaseOptions {
  /**
   * Kernel along y axis.
   */
  kernelY: number[][];
}

export interface GradientFilterXYOptions extends GradientFilterBaseOptions {
  /**
   * Kernel along x axis.
   */
  kernelX: number[][];
  /**
   * Kernel along y axis.
   */
  kernelY: number[][];
}

export type GradientFilterOptions =
  GradientFilterXOptions | GradientFilterYOptions | GradientFilterXYOptions;

/**
 * Apply a gradient filter to an image.
 * @param image - The image to process.
 * @param options - Gradient filter options.
 * @returns The gradient image.
 */
export function gradientFilter(
  image: Image,
  options: GradientFilterOptions,
): Image {
  const {
    borderType = 'replicate',
    borderValue = 0,
    bitDepth = image.bitDepth,
  } = options;

  checkProcessable(image, {
    bitDepth: [8, 16],
    colorModel: 'GREY',
  });

  if (bitDepth !== 8 && bitDepth !== 16) {
    throw new RangeError(`This image bit depth is not supported: ${bitDepth}`);
  }

  if ('kernelX' in options && 'kernelY' in options) {
    const { kernelX, kernelY } = options;
    const gradientX = image.rawDirectConvolution(kernelX, {
      borderType,
      borderValue,
    });

    const gradientY = image.rawDirectConvolution(kernelY, {
      borderType,
      borderValue,
    });

    const gradient = new Image(image.width, image.height, {
      bitDepth,
      colorModel: 'GREY',
    });

    const { maxValue } = gradient;
    for (let i = 0; i < image.size; i++) {
      // Saturate values that are out of range. In-range values are truncated
      // by the typed array, which is the historical behavior.
      const value = Math.hypot(gradientX[i], gradientY[i]);
      gradient.setValueByIndex(i, 0, Math.min(value, maxValue));
    }
    return gradient;
  } else if ('kernelX' in options) {
    return convolutionToBitDepth(image, options.kernelX, bitDepth, {
      borderType,
      borderValue,
    });
  } else if ('kernelY' in options) {
    return convolutionToBitDepth(image, options.kernelY, bitDepth, {
      borderType,
      borderValue,
    });
  } else {
    throw new TypeError(`kernelX and KernelY are not defined`);
  }
}

/**
 * Apply a convolution and store the result in an image of the given bit depth.
 * The output values are rounded and clamped, like in `directConvolution`.
 * @param image - Image to process.
 * @param kernel - Kernel to use for the convolution.
 * @param bitDepth - Bit depth of the resulting image.
 * @param options - Options for the convolution.
 * @param options.borderType - How the borders should be handled.
 * @param options.borderValue - Value of the border if `borderType` is `'constant'`.
 * @returns The convoluted image.
 */
function convolutionToBitDepth(
  image: Image,
  kernel: number[][],
  bitDepth: BitDepth,
  options: { borderType: BorderType; borderValue: number },
): Image {
  if (bitDepth === image.bitDepth) {
    return image.directConvolution(kernel, options);
  }
  const convolutedData = image.rawDirectConvolution(kernel, options);
  const newImage = new Image(image.width, image.height, {
    bitDepth,
    colorModel: image.colorModel,
  });
  const clamp = getClamp(newImage);
  for (let i = 0; i < image.size; i++) {
    for (let channel = 0; channel < image.channels; channel++) {
      newImage.setValueByIndex(
        i,
        channel,
        round(clamp(convolutedData[i * image.channels + channel])),
      );
    }
  }
  return newImage;
}
