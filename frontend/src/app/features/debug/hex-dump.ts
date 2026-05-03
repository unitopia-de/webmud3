/**
 * Builds a `xxd`-style hex+printable dump of a string. Useful for diagnosing
 * mysterious "missing characters" problems — once the chunk arriving from the
 * MUD is rendered as bytes, it is obvious whether the data is already broken
 * before xterm sees it (encoding / framing issue) or only afterwards
 * (xterm parser issue).
 *
 * Example output (16 bytes per row):
 *   0000 1B 5B 30 6D 48 61 6C 6C 6F 20 57 65 6C 74 21 0A   .[0mHallo Welt!.
 */
const BYTES_PER_ROW = 16;

export function hexDump(text: string): string {
  const bytes = encodeAsBytes(text);
  const lines: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += BYTES_PER_ROW) {
    const slice = bytes.slice(offset, offset + BYTES_PER_ROW);
    const hex = Array.from(slice)
      .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ')
      .padEnd(BYTES_PER_ROW * 3 - 1, ' ');
    const printable = Array.from(slice)
      .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
      .join('');
    const offsetStr = offset.toString(16).padStart(4, '0').toUpperCase();
    lines.push(`${offsetStr}  ${hex}  ${printable}`);
  }

  return lines.join('\n');
}

function encodeAsBytes(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text);
  }

  // Fallback for environments without TextEncoder (very old test runners):
  // emit each UTF-16 code unit as two bytes (low/high). Good enough for
  // ASCII-heavy MUD output, which is the only case where we lack TextEncoder.
  const out = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const cu = text.charCodeAt(i);
    out[i * 2] = cu & 0xff;
    out[i * 2 + 1] = (cu >> 8) & 0xff;
  }
  return out;
}
