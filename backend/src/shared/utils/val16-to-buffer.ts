/**
 * Converts a number into a 16-bit representation, split into two 8-bit values.
 * @param {number} val - The value to be converted into 16-bit.
 * @returns {number[]} An array with the high and low bytes of the 16-bit value.
 */
export function val16ToBuffer(val: number): number[] {
  // Return an array containing the high byte and the low byte of the value.
  return [(val & 0xff00) >> 8, val & 0xff];
}
