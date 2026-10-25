import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';

import { OutputVerbosityService } from './output-verbosity.service';

const KEY = namespacedKey('webmud3-ez-output-verbosity');
const LEGACY_KEY = namespacedKey('webmud3-ez-quiet-output');

describe('OutputVerbosityService', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to "chatty" (validated NVDA/JAWS behaviour)', () => {
    expect(new OutputVerbosityService().level()).toBe('chatty');
  });

  it('reads a remembered level from storage', () => {
    localStorage.setItem(KEY, 'normal');
    expect(new OutputVerbosityService().level()).toBe('normal');
  });

  it('ignores a garbage stored value and falls back to the default', () => {
    localStorage.setItem(KEY, 'bogus');
    expect(new OutputVerbosityService().level()).toBe('chatty');
  });

  it('migrates the legacy "Ruhige Ausgabe" flag to "quiet"', () => {
    localStorage.setItem(LEGACY_KEY, '1');
    expect(new OutputVerbosityService().level()).toBe('quiet');
  });

  it('prefers the new key over the legacy flag', () => {
    localStorage.setItem(LEGACY_KEY, '1');
    localStorage.setItem(KEY, 'chatty');
    expect(new OutputVerbosityService().level()).toBe('chatty');
  });

  it('setLevel updates the signal and persists', () => {
    const svc = new OutputVerbosityService();
    svc.setLevel('quiet');
    expect(svc.level()).toBe('quiet');
    expect(localStorage.getItem(KEY)).toBe('quiet');
    // A fresh instance reads the persisted level back.
    expect(new OutputVerbosityService().level()).toBe('quiet');
  });
});
