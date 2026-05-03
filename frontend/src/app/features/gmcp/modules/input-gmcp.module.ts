import { inject, Injectable } from '@angular/core';

import type { GmcpModule } from '../gmcp-module';
import { GmcpService, GmcpMessage } from '../gmcp.service';

/**
 * GMCP module that announces support for the "Input" package to the MUD.
 *
 * Once registered, `Core.Supports.Set` includes "Input 1", which lets the
 * client send `Input.Complete <buffer>` requests for tab completion. The MUD
 * answers with exactly one of `Input.CompleteText`, `Input.CompleteChoice`
 * (wizard-only) or `Input.CompleteNone` — see `lib/i/player/gmcp.c::input.complete`.
 *
 * Routing of those replies happens via MudSignalService → InputCompletionService,
 * so handleMessage is intentionally a no-op here.
 */
@Injectable({ providedIn: 'root' })
export class InputGmcpModule implements GmcpModule {
  readonly supports = [{ name: 'Input', version: 1 }];

  constructor() {
    inject(GmcpService).registerModule(this);
  }

  handleMessage(_message: GmcpMessage): void {
    // No-op: MudSignalService routes Input.Complete* into typed signals.
  }
}
