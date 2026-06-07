import { hexDump } from './hex-dump';

describe('hexDump', () => {
  it('returns an empty string for empty input', () => {
    expect(hexDump('')).toBe('');
  });

  it('formats a short ASCII string with offset, hex and printable columns', () => {
    const out = hexDump('Hi');
    // "Hi" = 0x48 0x69
    expect(out).toContain('0000');
    expect(out).toContain('48 69');
    expect(out).toMatch(/Hi$/);
  });

  it('renders non-printable bytes as dots in the printable column', () => {
    // ESC (0x1B) then "A" (0x41)
    const out = hexDump('\x1bA');
    expect(out).toContain('1B 41');
    // ESC is non-printable → '.', A printable → 'A'
    expect(out.endsWith('.A')).toBe(true);
  });

  it('wraps to a new row every 16 bytes', () => {
    const out = hexDump('0123456789ABCDEF' + 'X');
    const rows = out.split('\n');
    expect(rows).toHaveLength(2);
    expect(rows[0].startsWith('0000')).toBe(true);
    // Second row offset is 0x10.
    expect(rows[1].startsWith('0010')).toBe(true);
    expect(rows[1].endsWith('X')).toBe(true);
  });

  it('encodes multibyte UTF-8 characters as their byte sequence', () => {
    // "ä" = U+00E4 → UTF-8 0xC3 0xA4
    const out = hexDump('ä');
    expect(out).toContain('C3 A4');
  });
});
