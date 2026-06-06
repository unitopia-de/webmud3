import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { CommGmcpModule } from '@webmud3/frontend/features/gmcp/modules/comm-gmcp.module';
import { WindowGeometryService } from '@webmud3/frontend/features/windows/window-geometry.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';
import { CommlogService } from './commlog.service';

const MENU_ID = 'commlog-window';
const GEOMETRY_KEY = 'commlog-window';

const DEFAULT_X = 160;
const DEFAULT_Y = 160;
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 360;

/**
 * Wires the CommLog feature into the application:
 *  - registers the "CommLog" toggle in the footer menu
 *  - bootstraps CommGmcpModule so the MUD announces "Comm 1" and starts
 *    pushing Comm.Say / Comm.Soul / Comm.Tell
 *  - opens / closes the CommLog window and keeps the menu's checked state in
 *    sync if the user closes it via the X button
 *  - persists position + size between sessions via WindowGeometryService
 */
@Injectable({ providedIn: 'root' })
export class CommlogWindowService {
  private readonly windowService = inject(WindowService);
  private readonly footerMenu = inject(FooterMenuService);
  private readonly geometry = inject(WindowGeometryService);
  // Bootstraps the GMCP "Comm" registration as a side-effect of inject, so
  // "Comm 1" ends up in Core.Supports.Set and the MUD starts pushing Comm.*.
  private readonly _module = inject(CommGmcpModule);
  // Eager-instantiate the state service so it captures Comm.* signals even
  // before the window is opened for the first time.
  private readonly _state = inject(CommlogService);

  private windowId: string | undefined;
  private windowSubscription: Subscription | undefined;
  private cachedConfig: WindowConfig | undefined;

  constructor() {
    this.footerMenu.register({
      id: MENU_ID,
      label: 'CommLog',
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

    const saved = this.geometry.load(GEOMETRY_KEY);

    this.windowId = this.windowService.newWindow({
      title: 'CommLog',
      component: 'commlog',
      posX: saved?.x ?? DEFAULT_X,
      posY: saved?.y ?? DEFAULT_Y,
      width: saved?.w ?? DEFAULT_WIDTH,
      height: saved?.h ?? DEFAULT_HEIGHT,
    });

    this.cachedConfig = this.windowService.getWindow(this.windowId);
    this.footerMenu.setChecked(MENU_ID, true);

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
