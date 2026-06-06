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
 * It is bootstrapped by CommlogWindowService so the CommLog window can collect
 * the communication events the MUD then pushes.
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
