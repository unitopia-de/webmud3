import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';
import { PerfHudService } from './perf-hud.service';

const KEY = namespacedKey('webmud3-ez-perf-hud');

describe('PerfHudService', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('defaults to off with no URL param and no stored value', () => {
    expect(new PerfHudService().enabled()).toBe(false);
  });

  it('reads a remembered "on" state from storage', () => {
    localStorage.setItem(KEY, '1');
    expect(new PerfHudService().enabled()).toBe(true);
  });

  it('?perf=1 enables and persists (sticky)', () => {
    window.history.replaceState(null, '', '/?perf=1');
    expect(new PerfHudService().enabled()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');
  });

  it('?perf=0 disables and forgets the stored value', () => {
    localStorage.setItem(KEY, '1');
    window.history.replaceState(null, '', '/?perf=0');
    expect(new PerfHudService().enabled()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('toggle flips and persists', () => {
    const svc = new PerfHudService();
    expect(svc.toggle()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');
    expect(svc.toggle()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
