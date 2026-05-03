import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { PlayermapGmcpModule } from '@webmud3/frontend/features/gmcp/modules/playermap-gmcp.module';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import { PlayermapService } from './playermap.service';

const MENU_ID = 'playermap-window';

/**
 * Window dimensions in pixels.
 *
 * The map content itself is exactly 25 cells wide and 25 cells tall, rendered
 * at 14px font with 1ch per cell (~8.4px) and a 1em row height (14px). With
 * 6px padding around the grid we end up at ~225x366px of pure content; the
 * window chrome (title bar + frame) adds the rest. Sized slightly generously
 * so the grid never gets clipped by sub-pixel rounding.
 */
const WINDOW_WIDTH = 240;
const WINDOW_HEIGHT = 410;

/**
 * Wires the playermap feature into the application:
 *  - registers the "Karte" toggle in the footer menu
 *  - opens / closes the playermap window
 *  - keeps the menu's checked state in sync if the user closes the window
 *    via its X button
 *  - bootstraps PlayermapGmcpModule so UNItopia announces "Playermap 1"
 *    in the Core.Supports handshake and starts pushing Playermap.Info
 */
@Injectable({ providedIn: 'root' })
export class PlayermapWindowService {
  private readonly windowService = inject(WindowService);
  private readonly footerMenu = inject(FooterMenuService);
  // Bootstraps the GMCP "Playermap" registration as a side-effect of inject.
  private readonly _module = inject(PlayermapGmcpModule);
  // Eager-instantiate so the state is populated even before the window opens.
  private readonly _state = inject(PlayermapService);

  private windowId: string | undefined;
  private windowSubscription: Subscription | undefined;

  constructor() {
    this.footerMenu.register({
      id: MENU_ID,
      label: 'Karte',
      checked: false,
      action: () => this.toggle(),
    });
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
      return;
    }

    this.windowId = this.windowService.newWindow({
      title: 'Karte',
      component: 'playermap',
      posX: 120,
      posY: 120,
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
    });

    this.footerMenu.setChecked(MENU_ID, true);

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
}
