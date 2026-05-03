import { inject, Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { GmcpService } from '@webmud3/frontend/features/gmcp/gmcp.service';
import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import { WindowGeometryService } from '@webmud3/frontend/features/windows/window-geometry.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';
import { FilesService } from './files.service';

const MENU_ID = 'dirlist-window';
const GEOMETRY_KEY = 'dirlist-window';

const DIRLIST_DEFAULT_WIDTH = 460;
const DIRLIST_DEFAULT_HEIGHT = 360;
const DIRLIST_DEFAULT_X = 60;
const DIRLIST_DEFAULT_Y = 60;

/**
 * Wires the directory browser into the application.
 *
 * Visibility rule: the "Verzeichnis" footer menu entry is only registered
 * when the connected character is a wizard. We detect that via the `wizard`
 * field in the `Char.Name` GMCP message (UNItopia sends a non-zero number
 * for wizards, absent for regular players); ordinary players never see the
 * entry.
 *
 * When the user clicks the entry, a directory window is opened. The actual
 * directory contents arrive asynchronously via `Files.DirectoryList` pushes
 * (handled by `FilesService` -> `DirlistComponent`).
 */
@Injectable({ providedIn: 'root' })
export class DirlistWindowService implements OnDestroy {
  private readonly windowService = inject(WindowService);
  private readonly footerMenu = inject(FooterMenuService);
  private readonly signals = inject(MudSignalService);
  private readonly gmcp = inject(GmcpService);
  private readonly files = inject(FilesService);
  private readonly geometry = inject(WindowGeometryService);

  private readonly subscriptions: Subscription[] = [];

  private windowId: string | undefined;
  private windowSubscription: Subscription | undefined;
  private cachedConfig: WindowConfig | undefined;
  private menuRegistered = false;

  constructor() {
    this.subscriptions.push(
      this.signals.on('Char.Name').subscribe((s) => {
        // UNItopia sends `wizard` as a non-zero number for wizard accounts
        // and omits it for regular players. Treat any truthy value as wizard.
        if (s.wizard) {
          this.ensureMenuRegistered();
        } else {
          this.ensureMenuUnregistered();
        }
      }),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }

    this.windowSubscription?.unsubscribe();
    this.ensureMenuUnregistered();
  }

  public toggle(): void {
    if (this.windowId !== undefined) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    if (this.windowId !== undefined) {
      this.windowService.focus(this.windowId);
      this.requestRefresh();
      return;
    }

    const saved = this.geometry.load(GEOMETRY_KEY);

    this.windowId = this.windowService.newWindow({
      title: 'Verzeichnis',
      component: 'dirlist',
      posX: saved?.x ?? DIRLIST_DEFAULT_X,
      posY: saved?.y ?? DIRLIST_DEFAULT_Y,
      width: saved?.w ?? DIRLIST_DEFAULT_WIDTH,
      height: saved?.h ?? DIRLIST_DEFAULT_HEIGHT,
    });

    this.cachedConfig = this.windowService.getWindow(this.windowId);
    this.footerMenu.setChecked(MENU_ID, true);
    this.requestRefresh();

    this.windowSubscription = this.windowService.windows$.subscribe(
      (windows) => {
        if (
          this.windowId !== undefined &&
          !windows.some((w) => w.windowId === this.windowId)
        ) {
          this.persistGeometry();
          this.windowId = undefined;
          this.cachedConfig = undefined;
          this.windowSubscription?.unsubscribe();
          this.windowSubscription = undefined;
          this.footerMenu.setChecked(MENU_ID, false);
        }
      },
    );
  }

  public close(): void {
    if (this.windowId === undefined) {
      return;
    }

    this.persistGeometry();

    const id = this.windowId;
    this.windowId = undefined;
    this.cachedConfig = undefined;
    this.windowSubscription?.unsubscribe();
    this.windowSubscription = undefined;
    this.footerMenu.setChecked(MENU_ID, false);
    this.windowService.close(id);
  }

  private persistGeometry(): void {
    const c = this.cachedConfig;
    if (!c) {
      return;
    }
    this.geometry.save(GEOMETRY_KEY, {
      x: c.posX,
      y: c.posY,
      w: c.width,
      h: c.height,
    });
  }

  /**
   * Asks the MUD to (re)send the directory listing.
   *
   * UNItopia has no dedicated "request current directory" message — the
   * server pushes the initial listing automatically when the `Files`
   * package is registered (only for wizards). For an explicit refresh on
   * an already-loaded window we send `Files.ChDir` against the last known
   * path, which the MUD answers with a fresh `Files.DirectoryList`.
   *
   * If we have not yet seen any directory (first open, package just being
   * registered), this is a no-op — the server-pushed initial listing is
   * already on its way.
   */
  public requestRefresh(): void {
    const current = this.files.getCurrentListing();

    if (current && current.path) {
      this.gmcp.send('Files.ChDir', { dir: current.path });
    }
  }

  // ---------------------------------------------------------------------------
  // Footer menu lifecycle
  // ---------------------------------------------------------------------------

  private ensureMenuRegistered(): void {
    if (this.menuRegistered) {
      return;
    }

    this.footerMenu.register({
      id: MENU_ID,
      label: 'Verzeichnis',
      checked: this.windowId !== undefined,
      action: () => this.toggle(),
    });

    this.menuRegistered = true;
  }

  private ensureMenuUnregistered(): void {
    if (!this.menuRegistered) {
      return;
    }

    if (this.windowId !== undefined) {
      this.close();
    }

    this.footerMenu.unregister(MENU_ID);
    this.menuRegistered = false;
  }
}
