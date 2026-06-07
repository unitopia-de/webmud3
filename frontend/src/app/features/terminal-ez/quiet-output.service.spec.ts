import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';
import { QuietOutputService } from './quiet-output.service';

const KEY = namespacedKey('webmud3-ez-quiet-output');

describe('QuietOutputService', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to off', () => {
    expect(new QuietOutputService().enabled()).toBe(false);
  });

  it('reads a remembered "on" state from storage', () => {
    localStorage.setItem(KEY, '1');
    expect(new QuietOutputService().enabled()).toBe(true);
  });

  it('toggle flips and persists', () => {
    const svc = new QuietOutputService();
    expect(svc.toggle()).toBe(true);
    expect(svc.enabled()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');

    expect(svc.toggle()).toBe(false);
    expect(svc.enabled()).toBe(false);
    // Off removes the key rather than storing '0'.
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('setEnabled persists explicitly', () => {
    const svc = new QuietOutputService();
    svc.setEnabled(true);
    expect(new QuietOutputService().enabled()).toBe(true);
  });
});
