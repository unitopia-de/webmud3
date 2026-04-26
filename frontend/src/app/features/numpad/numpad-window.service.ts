import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { FooterMenuService } from '@webmud3/frontend/features/footer/footer-menu.service';
import { WindowService } from '@webmud3/frontend/features/windows/window.service';
import { NumpadService } from './numpad.service';

const MENU_ID = 'numpad-config-window';

/**
 * Footer-menu integration for the numpad config window.
 * Eager-instantiates NumpadService so bindings are loaded from localStorage
 * at app start.
 */
@Injectable({ providedIn: 'root' })
export class NumpadWindowService {
  private readonly windowService = inject(WindowService);
  private readonly footerMenu = inject(FooterMenuService);
  // Eager-instantiate the numpad state service.
  private readonly _numpad = inject(NumpadService);

  private windowId: string | undefined;
  private windowSubscription: Subscription | undefined;

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

    this.windowId = this.windowService.newWindow({
      title: 'Numpad-Konfiguration',
      component: 'numpad-config',
      posX: 120,
      posY: 120,
      width: 280,
      height: 360,
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
