import { inject, Injectable } from '@angular/core';

import type { GmcpModule } from '../gmcp-module';
import { GmcpService, GmcpMessage } from '../gmcp.service';

/**
 * GMCP module that announces support for the "Char" package to the MUD server.
 *
 * Once registered, the GmcpService includes "Char 1" in its `Core.Supports.Set`
 * handshake, which causes UNItopia (and other MUDs) to start sending
 *   Char.Name, Char.Vitals, Char.Status, Char.Stats
 * messages.
 *
 * The actual UI handling of these messages happens via MudSignalService, which
 * subscribes to the global GMCP message stream and emits typed signals. So
 * `handleMessage` here intentionally does nothing — its only job is to keep
 * the registration alive.
 */
@Injectable({ providedIn: 'root' })
export class CharGmcpModule implements GmcpModule {
  readonly supports = [{ name: 'Char', version: 1 }];

  constructor() {
    inject(GmcpService).registerModule(this);
  }

  handleMessage(_message: GmcpMessage): void {
    // No-op: the MudSignalService already routes these messages
    // (Char.Name, Char.Vitals, Char.Status, Char.Stats) into typed signals.
  }
}
