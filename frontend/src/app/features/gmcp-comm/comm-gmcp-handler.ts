import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import type { GmcpModuleHandler } from '../gmcp/gmcp-module-handler';

/**
 * A single communication message received via GMCP.
 */
export interface CommMessage {
  /** Message type: Say, Soul, or Tell */
  type: string;
  /** Raw payload from the MUD */
  data: unknown;
}

/**
 * GMCP handler for the `Comm` module.
 *
 * Handles communication channels from the MUD:
 * - `Comm.Say`  → Someone speaks in the room
 * - `Comm.Soul` → Someone performs a soul action
 * - `Comm.Tell` → Someone sends a private message
 *
 * Minimal implementation: messages are published on an observable stream.
 * In u1, these are rendered as regular MUD output.
 * A future enhancement could add a separate communication panel.
 */
@Injectable({ providedIn: 'root' })
export class CommGmcpHandler implements GmcpModuleHandler {
  readonly moduleName = 'Comm';
  readonly version = '1';

  /** Observable stream of all communication messages */
  public readonly commMessage$ = new Subject<CommMessage>();

  /**
   * Routes incoming GMCP `Comm.*` messages.
   */
  handleMessage(message: string, data: unknown): void {
    switch (message) {
      case 'Say':
      case 'Soul':
      case 'Tell':
        this.commMessage$.next({ type: message, data });
        console.debug(`[CommGmcpHandler] ${message}:`, data);
        break;

      default:
        console.debug(`[CommGmcpHandler] Unknown message: Comm.${message}`, data);
    }
  }

  /**
   * Cleanup.
   */
  dispose(): void {
    console.info('[CommGmcpHandler] Disposed.');
  }
}
