import { sizeToBuffer } from './size-to-buffer.js';

describe('sizeToBuffer', () => {
  it('should convert width and height into a buffer of four bytes', () => {
    const buf = sizeToBuffer(0x1234, 0xabcd);

    expect([...buf]).toEqual([0x12, 0x34, 0xab, 0xcd]);
  });

  it('should handle zeros correctly', () => {
    const buf = sizeToBuffer(0, 0);

    expect([...buf]).toEqual([0, 0, 0, 0]);
  });

  it('should handle single byte values correctly', () => {
    const buf = sizeToBuffer(0x00ff, 0x00ff);

    expect([...buf]).toEqual([0, 255, 0, 255]);
  });
});
