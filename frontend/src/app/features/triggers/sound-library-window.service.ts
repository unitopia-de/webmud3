import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { WindowGeometryService } from '@webmud3/frontend/features/windows/window-geometry.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import type { WindowConfig } from '@webmud3/frontend/features/windows/window-config';

const MENU_ID = 'sound-library-window';
const GEOMETRY_KEY = 'sound-library-window';

const DEFAULT_X = 200;
const DEFAULT_Y = 120;
const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 420;

/**
 * Opens / closes the sound library window. Mirrors the
 * `TriggerConfigWindowService` pattern.
 */
@Injectable({ providedIn: 'root' })
export class SoundLibraryWindowService {
  private readonly windowService = inject(WindowService);
  private readonly footerMenu = inject(FooterMenuService);
  private readonly geometry = inject(WindowGeometryService);

  private windowId: string | undefined;
  private windowSubscription: Subscription | undefined;
  private cachedConfig: WindowConfig | undefined;

  constructor() {
    this.footerMenu.register({
      id: MENU_ID,
      label: 'Sounds…',
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
      title: 'Sounds',
      component: 'sound-library',
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
