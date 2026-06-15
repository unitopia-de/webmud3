import { namespacedKey } from '@webmud3/frontend/shared/utils/storage-namespace';
import {
  EXPORTABLE_SETTING_KEYS,
  SettingsTransferService,
} from './settings-transfer.service';

describe('SettingsTransferService', () => {
  let svc: SettingsTransferService;

  beforeEach(() => {
    localStorage.clear();
    svc = new SettingsTransferService();
  });

  describe('buildExport', () => {
    it('collects only the whitelist keys that are actually set', () => {
      localStorage.setItem(namespacedKey('webmud3-terminal-theme'), 'dark');
      localStorage.setItem(namespacedKey('webmud3-ez-output-verbosity'), 'quiet');
      // Not in the whitelist → must be ignored.
      localStorage.setItem(namespacedKey('webmud3-session-token'), 'secret');
      localStorage.setItem(namespacedKey('webmud3-history'), 'huge backlog');

      const exp = svc.buildExport();

      expect(exp.app).toBe('webmud3');
      expect(exp.kind).toBe('settings');
      expect(exp.entries).toEqual({
        'webmud3-terminal-theme': 'dark',
        'webmud3-ez-output-verbosity': 'quiet',
      });
      // Sensitive / non-setting keys never leak into the export.
      expect(exp.entries['webmud3-session-token']).toBeUndefined();
      expect(exp.entries['webmud3-history']).toBeUndefined();
    });

    it('never exports the deliberately excluded keys even if present', () => {
      for (const k of [
        'webmud3-session-token',
        'webmud3-known-server-id',
        'webmud3-history',
        'webmud3-window-geometry',
      ]) {
        localStorage.setItem(namespacedKey(k), 'x');
        expect(EXPORTABLE_SETTING_KEYS).not.toContain(k);
      }
      expect(svc.buildExport().entries).toEqual({});
    });
  });

  describe('applyImport', () => {
    it('writes whitelist keys and reports the count', () => {
      const file = JSON.stringify({
        app: 'webmud3',
        kind: 'settings',
        version: 1,
        exportedAt: '2026-06-15T00:00:00.000Z',
        entries: {
          'webmud3-terminal-theme': 'light',
          'webmud3-sound-enabled': '0',
        },
      });

      const count = svc.applyImport(file);

      expect(count).toBe(2);
      expect(localStorage.getItem(namespacedKey('webmud3-terminal-theme'))).toBe(
        'light',
      );
      expect(localStorage.getItem(namespacedKey('webmud3-sound-enabled'))).toBe('0');
    });

    it('ignores keys that are not in the whitelist', () => {
      const file = JSON.stringify({
        app: 'webmud3',
        kind: 'settings',
        version: 1,
        exportedAt: '2026-06-15T00:00:00.000Z',
        entries: {
          'webmud3-terminal-theme': 'dark',
          'webmud3-session-token': 'evil',
          'totally-unknown': 'x',
        },
      });

      const count = svc.applyImport(file);

      expect(count).toBe(1);
      expect(localStorage.getItem(namespacedKey('webmud3-session-token'))).toBeNull();
      expect(localStorage.getItem(namespacedKey('totally-unknown'))).toBeNull();
    });

    it('throws on invalid JSON', () => {
      expect(() => svc.applyImport('{ not json')).toThrow();
    });

    it('throws when the file is not a webmud3 settings export', () => {
      const wrong = JSON.stringify({ app: 'something-else', entries: {} });
      expect(() => svc.applyImport(wrong)).toThrow();
    });

    it('round-trips an export back into storage', () => {
      localStorage.setItem(namespacedKey('webmud3-terminal-theme'), 'matrix');
      localStorage.setItem(namespacedKey('webmud3-ez-sticky-input'), '1');
      const json = svc.serialize();

      localStorage.clear();
      const count = svc.applyImport(json);

      expect(count).toBe(2);
      expect(localStorage.getItem(namespacedKey('webmud3-terminal-theme'))).toBe(
        'matrix',
      );
      expect(localStorage.getItem(namespacedKey('webmud3-ez-sticky-input'))).toBe('1');
    });
  });
});
