export function mapToUnitopiaEncodings(charset: BufferEncoding): string | null {
  switch (charset) {
    case 'utf-8':
      return 'utf-8';
    case 'latin1':
      return 'iso-8859-1';
    case 'ascii':
      return 'us-ascii';
    default:
      return null;
  }
}

export function mapToServerEncodings(charset: string): BufferEncoding | null {
  switch (charset) {
    case 'utf8':
    case 'utf-8':
      return 'utf-8';
    case 'latin1':
    case 'iso-8859-1':
      return 'latin1';
    case 'ascii':
    case 'us-ascii':
      return 'ascii';
    default:
      return null;
  }
}
