import { inject, Injectable } from '@angular/core';

import type { GmcpModule } from '../gmcp-module';
import { GmcpService, GmcpMessage } from '../gmcp.service';

/**
 * GMCP module that announces support for the "Char.Items" package to the MUD.
 *
 * Once registered, `Core.Supports.Set` includes "Char.Items 1", so UNItopia
 * starts sending Char.Items.List, Char.Items.Add and Char.Items.Remove
 * messages.
 *
 * The actual UI handling lives in InventoryService, which subscribes to the
 * matching MudSignals. handleMessage is intentionally a no-op.
 */
@Injectable({ providedIn: 'root' })
export class CharItemsGmcpModule implements GmcpModule {
  readonly supports = [{ name: 'Char.Items', version: 1 }];

  constructor() {
    inject(GmcpService).registerModule(this);
  }

  handleMessage(_message: GmcpMessage): void {
    // No-op. MudSignalService routes Char.Items.* to InventoryService.
  }
}
