export function mapToServerEncodings(charset: string): BufferEncoding | null {
  switch (charset) {
    case 'UTF-8':
    case 'UTF8':
    case 'utf8':
    case 'utf-8':
      return 'utf-8';
    default:
      return null;
  }
}
