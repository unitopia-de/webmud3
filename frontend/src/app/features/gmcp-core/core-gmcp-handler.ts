import { inject, Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { GmcpService } from '../gmcp/gmcp.service';
import type { GmcpModuleHandler } from '../gmcp/gmcp-module-handler';
import { WindowService } from '../windows/window.service';

/**
 * GMCP handler for the `Core` module.
 *
 * Handles:
 * - `Core.Ping`    → Keep-alive: toggle visual indicator, measure latency, send pong
 * - `Core.Goodbye` → MUD signals logoff: reset GMCP state, close windows
 *
 * The Core module is special: Core.Hello and Core.Supports.Set are handled
 * directly by GmcpService during the handshake. This handler only processes
 * incoming Core messages from the MUD.
 */
@Injectable({ providedIn: 'root' })
export class CoreGmcpHandler implements GmcpModuleHandler {
  readonly moduleName = 'Core';
  readonly version = '1';

  private readonly gmcpService = inject(GmcpService);
  private readonly windowService = inject(WindowService);

  /** Visual ping toggle indicator (alternates with each ping) */
  public readonly pingToggle$ = new BehaviorSubject<boolean>(false);

  /** Last measured round-trip latency in milliseconds (null = no measurement yet) */
  public readonly latency$ = new BehaviorSubject<number | null>(null);

  /** Timestamp of the last outgoing ping (for latency calculation) */
  private lastPingSent = 0;

  /**
   * Routes incoming GMCP `Core.*` messages.
   */
  handleMessage(message: string, data: unknown): void {
    switch (message) {
      case 'Ping':
        this.handlePing();
        break;

      case 'Goodbye':
        this.handleGoodbye(data);
        break;

      case 'Hello':
        // MUD's Core.Hello response is logged by GmcpService.handleIncoming()
        break;

      default:
        console.debug(`[CoreGmcpHandler] Unknown message: Core.${message}`, data);
    }
  }

  /**
   * Sends a Core.Ping to the MUD and records the timestamp for latency measurement.
   */
  public sendPing(): void {
    this.lastPingSent = Date.now();
    this.gmcpService.sendOutgoing('Core', 'Ping', {});

    console.debug('[CoreGmcpHandler] Ping sent.');
  }

  /**
   * Cleanup when the Core module is unregistered.
   */
  dispose(): void {
    this.pingToggle$.next(false);
    this.latency$.next(null);
    this.lastPingSent = 0;

    console.info('[CoreGmcpHandler] Disposed.');
  }

  /**
   * Handles `Core.Ping` from the MUD.
   *
   * 1. If we sent a ping, calculate round-trip latency
   * 2. Toggle the visual ping indicator
   * 3. Send pong (echo the ping back)
   */
  private handlePing(): void {
    // Calculate latency if we initiated the ping
    if (this.lastPingSent > 0) {
      const latency = Date.now() - this.lastPingSent;
      this.latency$.next(latency);
      this.lastPingSent = 0;

      console.debug(`[CoreGmcpHandler] Ping latency: ${latency}ms`);
    }

    // Toggle visual indicator (like u1's togglePing)
    this.pingToggle$.next(!this.pingToggle$.value);

    // Send pong back to MUD
    this.gmcpService.sendOutgoing('Core', 'Ping', {});
  }

  /**
   * Handles `Core.Goodbye` from the MUD.
   *
   * Performs cleanup:
   * - Logs the goodbye message
   * - Resets GMCP state (disposes all handlers)
   * - Closes all open windows
   */
  private handleGoodbye(data: unknown): void {
    const message = typeof data === 'string'
      ? data
      : (data as { message?: string })?.message ?? 'MUD meldet Abmeldung';

    console.info(`[CoreGmcpHandler] Core.Goodbye received: ${message}`);

    // Close all modeless windows
    this.windowService.closeAll();

    // Reset GMCP state (this will call dispose() on all handlers including us)
    this.gmcpService.reset();
  }
}
