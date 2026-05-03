import { inject, Injectable } from '@angular/core';

import type { GmcpModule } from '@webmud3/frontend/features/gmcp/gmcp-module';
import { GmcpMessage, GmcpService } from '@webmud3/frontend/features/gmcp/gmcp.service';

/**
 * Announces support for the `Sound` package to the MUD.
 *
 * Once registered, `Core.Supports.Set` includes "Sound 1", and UNItopia
 * starts pushing `Sound.Url` (init) and `Sound.Event` messages. Routing
 * of those into typed signals is done by `MudSignalService`; the actual
 * audio playback lives in `SoundService`.
 *
 * `handleMessage` is intentionally a no-op — `MudSignalService` already
 * routes Sound.* into typed signals consumed by `SoundService`.
 */
@Injectable({ providedIn: 'root' })
export class SoundGmcpModule implements GmcpModule {
  readonly supports = [{ name: 'Sound', version: 1 }];

  constructor() {
    inject(GmcpService).registerModule(this);
  }

  handleMessage(_message: GmcpMessage): void {
    // No-op. MudSignalService routes Sound.Url / Sound.Event to SoundService.
  }
}
