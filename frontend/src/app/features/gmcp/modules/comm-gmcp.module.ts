import { inject, Injectable } from '@angular/core';

import type { GmcpModule } from '../gmcp-module';
import { GmcpService, GmcpMessage } from '../gmcp.service';

/**
 * GMCP module that announces support for the UNItopia-specific "Comm"
 * package to the MUD.
 *
 * Once registered, `Core.Supports.Set` includes "Comm 1", which makes
 * `lib/i/player/gmcp.c` start forwarding say / soul / tell messages as
 * `Comm.Say`, `Comm.Soul` and `Comm.Tell`.
 *
 * This module is only instantiated when the experimental CommLog feature is
 * switched on via `?commlog=1` (see CommlogWindowService), so the MUD does not
 * push communication events unless the user opted in.
 *
 * Routing of the incoming Comm.* messages is handled by MudSignalService
 * (they become typed `Comm.Message` signals), so handleMessage is a no-op.
 */
@Injectable({ providedIn: 'root' })
export class CommGmcpModule implements GmcpModule {
  readonly supports = [{ name: 'Comm', version: 1 }];

  constructor() {
    inject(GmcpService).registerModule(this);
  }

  handleMessage(_message: GmcpMessage): void {
    // No-op: MudSignalService routes Comm.* into typed Comm.Message signals.
  }
}
