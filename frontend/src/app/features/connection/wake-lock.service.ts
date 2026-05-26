import { Injectable, OnDestroy } from '@angular/core';

/**
 * Wraps the Screen Wake Lock API so the app can keep the device's screen
 * on while a MUD session is active. Without this, mobile browsers (most
 * notably iOS Safari) suspend the tab once the screen turns off, which
 * stalls Socket.IO pings and eventually drops the underlying telnet
 * connection.
 *
 * The wake lock is released automatically by the browser whenever the tab
 * becomes hidden. The service listens for `visibilitychange` and
 * re-acquires the lock when the tab comes back into focus, so users only
 * need to call `acquire()` once at session start.
 *
 * On browsers without Wake Lock support (Firefox Android, older Safari,
 * non-secure contexts) every method is a silent no-op — callers do not
 * need to feature-detect themselves.
 */
@Injectable({ providedIn: 'root' })
export class WakeLockService implements OnDestroy {
  private sentinel: WakeLockSentinel | null = null;
  // Tracks whether the caller has asked us to hold a lock. We need this
  // separately from `sentinel`, because the browser releases the sentinel
  // on tab-hide; without remembering the intent we wouldn't know whether
  // to re-acquire on visibilitychange.
  private wanted = false;

  private readonly visibilityHandler = (): void => {
    if (document.visibilityState === 'visible' && this.wanted && !this.sentinel) {
      // Browser silently released the lock when the tab went hidden — pick
      // it back up so the next inactive period keeps the screen on too.
      void this.requestLock();
    }
  };

  constructor() {
    if (this.isSupported()) {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }
  }

  public ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    void this.release();
  }

  /**
   * Returns true if the current browser/context exposes the Wake Lock API.
   * The API is gated on a secure context (https or localhost).
   */
  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  /**
   * Asks the browser to keep the screen on. Safe to call multiple times —
   * a second call while a lock is already held is a no-op. Resolves to
   * `true` when a lock is in place, `false` otherwise (unsupported, user
   * permission denied, document not visible, …).
   */
  public async acquire(): Promise<boolean> {
    this.wanted = true;
    return this.requestLock();
  }

  /**
   * Explicitly releases the wake lock and stops re-acquiring it on
   * visibility changes. Intended for cleanup when the MUD session ends.
   */
  public async release(): Promise<void> {
    this.wanted = false;

    const sentinel = this.sentinel;
    this.sentinel = null;

    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch (err) {
        console.warn('[WakeLock] release failed:', err);
      }
    }
  }

  private async requestLock(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    if (this.sentinel && !this.sentinel.released) {
      return true;
    }

    // The Wake Lock request will reject if the document isn't visible —
    // we defer to the visibilitychange listener in that case.
    if (document.visibilityState !== 'visible') {
      return false;
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen');

      sentinel.addEventListener('release', () => {
        // Browser-initiated release (tab hidden, low battery, …). Clear
        // the field so the visibility handler can pick it up again.
        if (this.sentinel === sentinel) {
          this.sentinel = null;
        }
      });

      this.sentinel = sentinel;
      return true;
    } catch (err) {
      console.warn('[WakeLock] acquire failed:', err);
      return false;
    }
  }
}
