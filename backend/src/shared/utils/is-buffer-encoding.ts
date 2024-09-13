export function isBufferEncoding(encoding: string): encoding is BufferEncoding {
  return [
    'ascii',
    'utf8',
    'utf-8',
    'utf16le',
    'utf-16le',
    'ucs2',
    'ucs-2',
    'base64',
    'base64url',
    'latin1',
    'binary',
    'hex',
  ].includes(encoding);
}
