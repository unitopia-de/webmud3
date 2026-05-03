import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { GmcpService } from '@webmud3/frontend/features/gmcp/gmcp.service';
import { CharItemsGmcpModule } from '@webmud3/frontend/features/gmcp/modules/char-items-gmcp.module';
import { WindowGeometryService } from '@webmud3/frontend/features/windows/window-geometry.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';
import { InventoryService } from './inventory.service';

const MENU_ID = 'inventory-window';
const GEOMETRY_KEY = 'inventory-window';

const DEFAULT_X = 80;
const DEFAULT_Y = 80;
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 380;

/**
 * Wires the inventory feature into the application:
 *  - registers a "Inventar" toggle in the footer menu
 *  - opens / closes the inventory window
 *  - keeps the menu's checked state in sync if the user closes the window
 *    via its X button
 *  - bootstraps CharItemsGmcpModule so the MUD starts sending Char.Items.*
 *  - persists position + size between sessions via WindowGeometryService
 */
@Injectable({ providedIn: 'root' })
export class InventoryWindowService {
  private readonly windowService = inject(WindowService);
  private readonly footerMenu = inject(FooterMenuService);
  private readonly gmcp = inject(GmcpService);
  private readonly geometry = inject(WindowGeometryService);
  // Bootstraps the GMCP "Char.Items" registration as a side-effect of inject.
  private readonly _items = inject(CharItemsGmcpModule);
  // Eager-instantiate the inventory state service so it captures Char.Items.*
  // signals even before the window is opened for the first time.
  private readonly _inventoryState = inject(InventoryService);

  private windowId: string | undefined;
  private windowSubscription: Subscription | undefined;
  /**
   * Reference to the live WindowConfig kept after open(); the WindowComponent
   * mutates posX/posY/width/height on this same object during user interaction,
   * so saving from this reference always picks up the latest state — even
   * after the window has been removed from the windows$ list.
   */
  private cachedConfig: WindowConfig | undefined;

  constructor() {
    this.footerMenu.register({
      id: MENU_ID,
      label: 'Inventar',
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
      this.requestRefresh();
      return;
    }

    const saved = this.geometry.load(GEOMETRY_KEY);

    this.windowId = this.windowService.newWindow({
      title: 'Inventar',
      component: 'inventory',
      posX: saved?.x ?? DEFAULT_X,
      posY: saved?.y ?? DEFAULT_Y,
      width: saved?.w ?? DEFAULT_WIDTH,
      height: saved?.h ?? DEFAULT_HEIGHT,
    });

    this.cachedConfig = this.windowService.getWindow(this.windowId);
    this.footerMenu.setChecked(MENU_ID, true);
    this.requestRefresh();

    // Detect when the window is closed externally (X button, closeAll, ...)
    // by observing the windows list and reacting when our id disappears.
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

  /**
   * Asks the MUD to resend the full inventory list. UNItopia answers
   * `Char.Items.Inv` with a `Char.Items.List` message.
   * Silently no-ops if GMCP is not active yet.
   */
  public requestRefresh(): void {
    this.gmcp.send('Char.Items.Inv', {});
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
}
