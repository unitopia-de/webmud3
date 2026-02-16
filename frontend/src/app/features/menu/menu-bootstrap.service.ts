import { inject, Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { MenuService } from './menu.service';
import { GmcpService } from '../gmcp/gmcp.service';
import { CoreGmcpHandler } from '../gmcp-core/core-gmcp-handler';
import { WindowService } from '../windows/window.service';
import { ColorSettingsService } from '../settings/color-settings.service';
import type { MenuItem } from './menu-item';

/**
 * Initializes the application menu structure with default items.
 *
 * Called during APP_INITIALIZER. Sets up:
 * - "Ansicht" menu (Scroll-Lock, future color settings)
 * - "GMCP" menu (refreshed from GMCP module handlers)
 * - "Fenster" menu (list of open windows)
 *
 * Listens to GMCP start events to refresh the GMCP menu
 * and to window changes to update the window list.
 */
@Injectable({ providedIn: 'root' })
export class MenuBootstrapService {
  private readonly menuService = inject(MenuService);
  private readonly gmcpService = inject(GmcpService);
  private readonly coreHandler = inject(CoreGmcpHandler);
  private readonly windowService = inject(WindowService);
  private readonly colorSettingsService = inject(ColorSettingsService);

  private initialized = false;
  private readonly subscriptions: Subscription[] = [];

  /**
   * Sets up the initial menu structure.
   * Safe to call multiple times — only runs once.
   */
  public bootstrap(): void {
    if (this.initialized) {
      return;
    }

    this.initializeMenu();
    this.setupGmcpListener();
    this.setupWindowListener();

    this.initialized = true;

    console.info('[MenuBootstrap] Menu initialized.');
  }

  private initializeMenu(): void {
    const items: MenuItem[] = [
      {
        id: 'view',
        label: 'Ansicht',
        children: [
          {
            id: 'view-colors',
            label: 'Farbeinstellungen…',
            command: () => this.openColorSettings(),
          },
          {
            id: 'view-sep1',
            label: '',
            separator: true,
          },
          {
            id: 'view-ping',
            label: 'Ping senden',
            command: () => this.coreHandler.sendPing(),
          },
        ],
      },
      {
        id: 'gmcp',
        label: 'GMCP',
        children: [],
      },
      {
        id: 'windows',
        label: 'Fenster',
        children: [
          {
            id: 'windows-close-all',
            label: 'Alle schließen',
            command: () => this.windowService.closeAll(),
          },
        ],
      },
    ];

    this.menuService.setItems(items);
  }

  /** Window ID of the color settings dialog (only one at a time) */
  private colorSettingsWindowId: string | null = null;

  /**
   * Opens the color settings dialog as a modeless window.
   */
  private openColorSettings(): void {
    if (this.colorSettingsWindowId !== null) {
      this.windowService.focus(this.colorSettingsWindowId);
      return;
    }

    this.colorSettingsWindowId = this.windowService.open({
      title: 'Farbeinstellungen',
      componentType: 'ColorSettingsComponent',
      size: { width: 300, height: 260 },
    });

    const sub = this.windowService.outgoingEvents$.subscribe(event => {
      if (event.windowId === this.colorSettingsWindowId && event.action === 'closeParent') {
        this.colorSettingsWindowId = null;
        sub.unsubscribe();
      }
    });

    this.subscriptions.push(sub);
  }

  /**
   * When GMCP starts, refresh the GMCP menu with handler contributions.
   */
  private setupGmcpListener(): void {
    const sub = this.gmcpService.gmcpStart$.subscribe(() => {
      this.menuService.refreshGmcpMenuItems();
    });

    this.subscriptions.push(sub);
  }

  /**
   * Update the "Fenster" menu whenever the window list changes.
   */
  private setupWindowListener(): void {
    const sub = this.windowService.windows$.subscribe(windows => {
      const windowChildren: MenuItem[] = [
        {
          id: 'windows-close-all',
          label: 'Alle schließen',
          disabled: windows.length === 0,
          command: () => this.windowService.closeAll(),
        },
      ];

      if (windows.length > 0) {
        windowChildren.push({ id: 'windows-sep', label: '', separator: true });

        for (const win of windows) {
          windowChildren.push({
            id: `window-${win.windowId}`,
            label: win.title,
            command: () => this.windowService.focus(win.windowId),
          });
        }
      }

      this.menuService.registerItem(null, {
        id: 'windows',
        label: 'Fenster',
        children: windowChildren,
      });
    });

    this.subscriptions.push(sub);
  }
}
