import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { WindowGeometryService } from '@webmud3/frontend/features/windows/window-geometry.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';
import { NumpadService } from './numpad.service';

const MENU_ID = 'numpad-config-window';
const GEOMETRY_KEY = 'numpad-config-window';

const DEFAULT_X = 120;
const DEFAULT_Y = 120;
const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 360;

/**
 * Footer-menu integration for the numpad config window.
 * Eager-instantiates NumpadService so bindings are loaded from localStorage
 * at app start.
 */
@Injectable({ providedIn: 'root' })
export class NumpadWindowService {
  private readonly windowService = inject(WindowService);
  private readonly footerMenu = inject(FooterMenuService);
  private readonly geometry = inject(WindowGeometryService);
  // Eager-instantiate the numpad state service.
  private readonly _numpad = inject(NumpadService);

  private windowId: string | undefined;
  private windowSubscription: Subscription | undefined;
  private cachedConfig: WindowConfig | undefined;

  constructor() {
    this.footerMenu.register({
      id: MENU_ID,
      label: 'Numpad-Konfiguration',
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
      title: 'Numpad-Konfiguration',
      component: 'numpad-config',
      posX: saved?.x ?? DEFAULT_X,
      posY: saved?.y ?? DEFAULT_Y,
      width: saved?.w ?? DEFAULT_WIDTH,
      height: saved?.h ?? DEFAULT_HEIGHT,
    });

    this.cachedConfig = this.windowService.getWindow(this.windowId);
    this.footerMenu.setChecked(MENU_ID, true);

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
