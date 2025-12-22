import { isBufferEncoding } from './is-buffer-encoding.js';

describe('isBufferEncoding', () => {
  // Test für gültige BufferEncodings
  test('should return true for valid BufferEncodings', () => {
    expect(isBufferEncoding('ascii')).toBe(true);

    expect(isBufferEncoding('utf8')).toBe(true);

    expect(isBufferEncoding('utf-8')).toBe(true);

    expect(isBufferEncoding('utf16le')).toBe(true);

    expect(isBufferEncoding('utf-16le')).toBe(true);

    expect(isBufferEncoding('ucs2')).toBe(true);

    expect(isBufferEncoding('ucs-2')).toBe(true);

    expect(isBufferEncoding('base64')).toBe(true);

    expect(isBufferEncoding('base64url')).toBe(true);

    expect(isBufferEncoding('latin1')).toBe(true);

    expect(isBufferEncoding('binary')).toBe(true);

    expect(isBufferEncoding('hex')).toBe(true);
  });

  // Test für ungültige BufferEncodings
  test('should return false for invalid BufferEncodings', () => {
    expect(isBufferEncoding('UTF8')).toBe(false); // Großbuchstaben

    expect(isBufferEncoding('utf 8')).toBe(false); // Leerzeichen

    expect(isBufferEncoding('UTF-16')).toBe(false); // ungültige Kodierung

    expect(isBufferEncoding('utf-32')).toBe(false); // nicht unterstütztes Encoding

    expect(isBufferEncoding('')).toBe(false); // leerer String

    expect(isBufferEncoding('randomString')).toBe(false); // zufälliger String
  });

  // Edge Case Test: Unterschied zwischen ähnlichen Kodierungen
  test('should handle similar but invalid encodings', () => {
    expect(isBufferEncoding('utf16')).toBe(false); // Kein 'le' Suffix

    expect(isBufferEncoding('ucs')).toBe(false); // kein '-2'

    expect(isBufferEncoding('utf_8')).toBe(false); // falsches Zeichen (Unterstrich statt Bindestrich)
  });

  // Test für sehr lange Strings (Edge Case)
  test('should return false for excessively long strings', () => {
    const longString = 'a'.repeat(1000); // Sehr langer String

    expect(isBufferEncoding(longString)).toBe(false);
  });

  // Test für Strings mit Sonderzeichen (Edge Case)
  test('should return false for strings with special characters', () => {
    expect(isBufferEncoding('utf8!')).toBe(false); // Ungültiges Sonderzeichen

    expect(isBufferEncoding('base64$')).toBe(false); // Ungültiges Sonderzeichen

    expect(isBufferEncoding('latin@1')).toBe(false); // Ungültiges Sonderzeichen
  });

  // Test für undefined oder null (Edge Case)
  test('should return false for undefined or null', () => {
    expect(isBufferEncoding(undefined as unknown as string)).toBe(false);

    expect(isBufferEncoding(null as unknown as string)).toBe(false);
  });
});
