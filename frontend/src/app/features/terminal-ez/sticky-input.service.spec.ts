import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';
import { StickyInputService } from './sticky-input.service';

const KEY = namespacedKey('webmud3-ez-sticky-input');

describe('StickyInputService', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to off', () => {
    expect(new StickyInputService().enabled).toBe(false);
  });

  it('reads a remembered state ("1" or legacy "true")', () => {
    localStorage.setItem(KEY, '1');
    expect(new StickyInputService().enabled).toBe(true);

    localStorage.setItem(KEY, 'true');
    expect(new StickyInputService().enabled).toBe(true);
  });

  it('toggle flips, persists and returns the new value', () => {
    const svc = new StickyInputService();
    expect(svc.toggle()).toBe(true);
    expect(svc.enabled).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');

    expect(svc.toggle()).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('0');
  });

  it('emits state changes on enabled$', () => {
    const svc = new StickyInputService();
    const seen: boolean[] = [];
    const sub = svc.enabled$.subscribe((v) => seen.push(v));
    svc.setEnabled(true);
    svc.setEnabled(true); // no-op, value unchanged → no extra emission
    svc.setEnabled(false);
    expect(seen).toEqual([false, true, false]);
    sub.unsubscribe();
  });
});
