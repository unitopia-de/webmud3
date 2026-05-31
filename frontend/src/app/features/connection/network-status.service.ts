import { inject, Injectable, signal } from '@angular/core';

import { MudService } from '@webmud3/frontend/core/mud/services/mud.service';

/**
 * Tracks the browser's network status and helps the socket recover quickly
 * after the conditions that kill mobile/PWA connections.
 *
 * Two triggers nudge the socket back up (via MudService.ensureConnected,
 * which is a no-op when already connected):
 *  - **online**: the OS regained network → reconnect instead of waiting for
 *    socket.io's backoff timer.
 *  - **visibilitychange → visible**: iOS/Android freeze background JS, so the
 *    auto-reconnect loop stalls while the app is hidden. On resume we kick it.
 *
 * The `online` signal is also consumed by the footer to show an offline
 * indicator. Instantiated for its side effects by AppComponent so it runs in
 * both shells.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly mudService = inject(MudService);

  /** True while the browser reports an active network connection. */
  public readonly online = signal(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  constructor() {
    window.addEventListener('online', () => {
      this.online.set(true);
      this.mudService.ensureConnected();
    });

    window.addEventListener('offline', () => {
      this.online.set(false);
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.mudService.ensureConnected();
      }
    });
  }
}
