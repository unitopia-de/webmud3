import { inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';

/**
 * Notifies the user when a new app version has been downloaded by the Service
 * Worker and is ready to activate.
 *
 * `SwUpdate.versionUpdates` emits `VERSION_READY` once the new version is fully
 * cached. We then surface a footer-menu entry "Neue Version verfügbar – neu
 * laden" (pinned to the top). Clicking it activates the new version and
 * reloads. Without this, an installed PWA would keep running the old version
 * until the user happens to fully restart it.
 *
 * Instantiated for its side effects by AppComponent. No-op when the Service
 * Worker is disabled (dev builds / non-secure contexts).
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly footerMenu = inject(FooterMenuService);

  private readonly MENU_ID = 'pwa-update';

  constructor() {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.swUpdate.versionUpdates
      .pipe(
        filter(
          (event): event is VersionReadyEvent =>
            event.type === 'VERSION_READY',
        ),
      )
      .subscribe(() => this.registerEntry());
  }

  private registerEntry(): void {
    this.footerMenu.register({
      id: this.MENU_ID,
      label: 'Neue Version verfügbar – neu laden',
      icon: '⟳',
      // Negative order pins it to the very top so it stands out.
      order: -10,
      checked: false,
      action: () => void this.activateAndReload(),
    });
  }

  private async activateAndReload(): Promise<void> {
    try {
      await this.swUpdate.activateUpdate();
    } finally {
      document.location.reload();
    }
  }
}
