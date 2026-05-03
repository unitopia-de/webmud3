import { inject, Injectable } from '@angular/core';

import type { GmcpModule } from '../gmcp-module';
import { GmcpService, GmcpMessage } from '../gmcp.service';

/**
 * GMCP module that announces support for the UNItopia-specific "Playermap"
 * package to the MUD.
 *
 * Once registered, `Core.Supports.Set` includes "Playermap 1", which causes
 * `lib/i/player/gmcp.c::gmcp_handler` to bind `notify_moved` to the player
 * and start sending `Playermap.Info` on every movement (and once initially).
 *
 * Routing of incoming Playermap.Info messages is handled by MudSignalService,
 * so handleMessage is intentionally a no-op.
 */
@Injectable({ providedIn: 'root' })
export class PlayermapGmcpModule implements GmcpModule {
  readonly supports = [{ name: 'Playermap', version: 1 }];

  constructor() {
    inject(GmcpService).registerModule(this);
  }

  handleMessage(_message: GmcpMessage): void {
    // No-op: MudSignalService routes Playermap.Info into typed signals.
  }
}
