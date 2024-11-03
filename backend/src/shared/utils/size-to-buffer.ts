import { val16ToBuffer } from './val16-to-buffer.js';

/**
 * Converts two numeric width and height values into a Buffer encoding their values in 16-bit.
 * @param {number} w - The width value to encode.
 * @param {number} h - The height value to encode.
 * @returns {Buffer} A Buffer object containing the 16-bit encoded width and height.
 */
export function sizeToBuffer(w: number, h: number): Buffer {
  // Combine the 16-bit buffers for width and height into a single array.
  const result = [...val16ToBuffer(w), ...val16ToBuffer(h)];

  // Convert the array of numbers into a Buffer and return it.
  return Buffer.from(result);
}
