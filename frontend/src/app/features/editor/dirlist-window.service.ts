import { inject, Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { GmcpService } from '@webmud3/frontend/features/gmcp/gmcp.service';
import { MudSignalService } from '@webmud3/frontend/features/gmcp/signals/mud-signal.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';

const MENU_ID = 'dirlist-window';

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

  private readonly subscriptions: Subscription[] = [];

  private windowId: string | undefined;
  private windowSubscription: Subscription | undefined;
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

    this.windowId = this.windowService.newWindow({
      title: 'Verzeichnis',
      component: 'dirlist',
      posX: DIRLIST_DEFAULT_X,
      posY: DIRLIST_DEFAULT_Y,
      width: DIRLIST_DEFAULT_WIDTH,
      height: DIRLIST_DEFAULT_HEIGHT,
    });

    this.footerMenu.setChecked(MENU_ID, true);
    this.requestRefresh();

    this.windowSubscription = this.windowService.windows$.subscribe(
      (windows) => {
        if (
          this.windowId !== undefined &&
          !windows.some((w) => w.windowId === this.windowId)
        ) {
          this.windowId = undefined;
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

    const id = this.windowId;
    this.windowId = undefined;
    this.windowSubscription?.unsubscribe();
    this.windowSubscription = undefined;
    this.footerMenu.setChecked(MENU_ID, false);
    this.windowService.close(id);
  }

  /**
   * Asks the MUD to (re)send the current directory listing. UNItopia
   * answers with `Files.DirectoryList`. Silently no-ops if GMCP is not
   * active yet.
   */
  public requestRefresh(): void {
    this.gmcp.send('Files.RequestDir', {});
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
