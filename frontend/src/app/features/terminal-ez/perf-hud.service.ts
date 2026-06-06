import { Injectable, signal } from '@angular/core';

import { namespacedStorage } from '@webmud3/frontend/shared/utils/storage-namespace';

const STORAGE_SUFFIX = 'webmud3-ez-perf-hud';

/**
 * Controls the EZ-Shell's on-screen performance HUD.
 *
 * The HUD mirrors slow-chunk diagnostics onto the screen for devices without
 * a reachable developer console (iPad). Two ways to switch it on:
 *
 *  - URL: append `?perf=1` (sticky — remembered in localStorage; `?perf=0`
 *    turns it off again). Handy in a desktop browser tab.
 *  - In-app: the shell registers a "Performance-Anzeige" footer-menu toggle.
 *    This is the only option once the app runs as an installed PWA (no address
 *    bar) and is reachable by VoiceOver, so a blind tester can enable it too.
 *
 * Lives in its own root singleton because the toggle is registered by the
 * shell (footer menu) but the flag is read by the output component — mirrors
 * the existing StickyInputService pattern.
 */
@Injectable({ providedIn: 'root' })
export class PerfHudService {
  /** Reactive flag the output component binds to. */
  public readonly enabled = signal(false);

  constructor() {
    this.enabled.set(this.readInitial());
  }

  public setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    this.persist(enabled);
  }

  public toggle(): boolean {
    const next = !this.enabled();
    this.setEnabled(next);
    return next;
  }

  /**
   * Resolves the initial state: an explicit `?perf=1`/`?perf=0` wins and is
   * persisted; otherwise fall back to the remembered choice. Dependency-free
   * (no router) so it works regardless of how the shell routes.
   */
  private readInitial(): boolean {
    try {
      const param = new URLSearchParams(window.location.search).get('perf');
      if (param === '1' || param === '0') {
        const on = param === '1';
        this.persist(on);
        return on;
      }
      return namespacedStorage.get(STORAGE_SUFFIX) === '1';
    } catch {
      return false;
    }
  }

  private persist(enabled: boolean): void {
    if (enabled) {
      namespacedStorage.set(STORAGE_SUFFIX, '1');
    } else {
      namespacedStorage.remove(STORAGE_SUFFIX);
    }
  }
}
