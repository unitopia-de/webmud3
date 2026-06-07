import { namespacedKey, namespacedStorage } from './storage-namespace';

describe('storage-namespace', () => {
  beforeEach(() => localStorage.clear());

  it('namespacedKey prefixes the suffix with host+path (jsdom baseURI)', () => {
    // jsdom default baseURI is http://localhost/ → prefix "localhost".
    expect(namespacedKey('history')).toBe('localhost:history');
  });

  it('set/get round-trips through the namespaced key', () => {
    namespacedStorage.set('foo', 'bar');
    expect(localStorage.getItem('localhost:foo')).toBe('bar');
    expect(namespacedStorage.get('foo')).toBe('bar');
  });

  it('get returns null for a missing key', () => {
    expect(namespacedStorage.get('missing')).toBeNull();
  });

  it('remove deletes the namespaced entry', () => {
    namespacedStorage.set('foo', 'bar');
    namespacedStorage.remove('foo');
    expect(namespacedStorage.get('foo')).toBeNull();
  });

  it('migrates a legacy un-namespaced value forward on first read', () => {
    // Legacy entry written under the bare suffix (older build).
    localStorage.setItem('legacy', 'old-value');
    expect(namespacedStorage.get('legacy')).toBe('old-value');
    // The value is copied forward to the namespaced key, legacy left intact.
    expect(localStorage.getItem('localhost:legacy')).toBe('old-value');
    expect(localStorage.getItem('legacy')).toBe('old-value');
  });

  it('prefers the namespaced value over a legacy one', () => {
    localStorage.setItem('k', 'legacy');
    localStorage.setItem('localhost:k', 'current');
    expect(namespacedStorage.get('k')).toBe('current');
  });
});
