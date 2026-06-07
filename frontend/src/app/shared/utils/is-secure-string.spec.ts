import { isSecureString } from './is-secure-string';

describe('isSecureString', () => {
  it('returns false for a plain string', () => {
    expect(isSecureString('hello')).toBe(false);
    expect(isSecureString('')).toBe(false);
  });

  it('returns true for a SecureString object', () => {
    expect(isSecureString({ value: 'secret' })).toBe(true);
    expect(isSecureString({ value: '' })).toBe(true);
  });

  it('narrows the type so .value is accessible', () => {
    const input: string | { value: string } = { value: 'pw' };
    if (isSecureString(input)) {
      // Type-narrowed branch — must compile and read the field.
      expect(input.value).toBe('pw');
    } else {
      fail('expected SecureString branch');
    }
  });
});
