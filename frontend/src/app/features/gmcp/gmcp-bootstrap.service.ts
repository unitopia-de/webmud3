import { inject, Injectable } from '@angular/core';

import { GmcpService } from './gmcp.service';
import { CoreGmcpHandler } from '../gmcp-core/core-gmcp-handler';
import { CharGmcpHandler } from '../gmcp-char/char-gmcp-handler';
import { SoundGmcpHandler } from '../gmcp-sound/sound-gmcp-handler';
import { FilesGmcpHandler } from '../gmcp-files/files-gmcp-handler';
import { InputGmcpHandler } from '../gmcp-input/input-gmcp-handler';
import { NumpadGmcpHandler } from '../gmcp-numpad/numpad-gmcp-handler';
import { CommGmcpHandler } from '../gmcp-comm/comm-gmcp-handler';
import { RoomGmcpHandler } from '../gmcp-room/room-gmcp-handler';

/**
 * Central GMCP bootstrap service.
 *
 * Registers all known GMCP module handlers with the GmcpService.
 * Must be called once during application startup (via APP_INITIALIZER or
 * similar mechanism).
 *
 * This uses Angular DI to inject the handler singletons and registers them
 * with the GMCP routing registry so incoming messages are dispatched correctly.
 *
 * Registration order matters: Core must be registered first so that
 * Core.Supports.Set in handleGmcpStart() includes all modules.
 */
@Injectable({ providedIn: 'root' })
export class GmcpBootstrapService {
  private readonly gmcpService = inject(GmcpService);
  private readonly coreHandler = inject(CoreGmcpHandler);
  private readonly charHandler = inject(CharGmcpHandler);
  private readonly soundHandler = inject(SoundGmcpHandler);
  private readonly filesHandler = inject(FilesGmcpHandler);
  private readonly inputHandler = inject(InputGmcpHandler);
  private readonly numpadHandler = inject(NumpadGmcpHandler);
  private readonly commHandler = inject(CommGmcpHandler);
  private readonly roomHandler = inject(RoomGmcpHandler);

  private initialized = false;

  /**
   * Registers all GMCP module handlers.
   * Safe to call multiple times — only runs once.
   */
  public bootstrap(): void {
    if (this.initialized) {
      return;
    }

    this.gmcpService.registerModule(this.coreHandler);
    this.gmcpService.registerModule(this.charHandler);
    this.gmcpService.registerModule(this.soundHandler);
    this.gmcpService.registerModule(this.filesHandler);
    this.gmcpService.registerModule(this.inputHandler);
    this.gmcpService.registerModule(this.numpadHandler);
    this.gmcpService.registerModule(this.commHandler);
    this.gmcpService.registerModule(this.roomHandler);

    this.initialized = true;

    console.info('[GmcpBootstrap] All GMCP handlers registered.');
  }
}
