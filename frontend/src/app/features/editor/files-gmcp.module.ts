import { inject, Injectable } from '@angular/core';

import type { GmcpModule } from '../gmcp/gmcp-module';
import { GmcpMessage, GmcpService } from '../gmcp/gmcp.service';

/**
 * GMCP module that announces support for the "Files" package to the MUD.
 *
 * Once registered, `Core.Supports.Set` includes "Files 1", which causes
 * UNItopia to send `Files.OpenFile` and `Files.DirectoryList` messages.
 *
 * The actual UI handling lives in FilesService, which subscribes to the
 * matching MudSignals (`Files.Open`, `Files.Dir`). `handleMessage` is
 * intentionally a no-op.
 */
@Injectable({ providedIn: 'root' })
export class FilesGmcpModule implements GmcpModule {
  readonly supports = [{ name: 'Files', version: 1 }];

  constructor() {
    inject(GmcpService).registerModule(this);
  }

  handleMessage(_message: GmcpMessage): void {
    // No-op. MudSignalService routes Files.* to FilesService.
  }
}
