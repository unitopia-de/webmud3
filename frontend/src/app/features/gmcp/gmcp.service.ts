import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

import type { GmcpSupport } from '@webmud3/shared';
import type { GmcpEvent } from './gmcp-event';
import type { GmcpModuleHandler } from './gmcp-module-handler';

/**
 * Callback type for sending outgoing GMCP messages via Socket.IO.
 * Set by SocketsService during initialization.
 */
export type GmcpSendFunction = (
  module: string,
  message: string,
  data: unknown,
) => void;

/** Client name sent in Core.Hello handshake */
const CLIENT_NAME = 'WebMud3';

/** Client version sent in Core.Hello handshake */
const CLIENT_VERSION = '0.7.0';

/**
 * Central GMCP service for the frontend.
 *
 * Responsibilities:
 * - Maintains a registry of active GMCP module handlers (Strategy Pattern)
 * - Routes incoming GMCP messages to the correct handler
 * - Provides an observable stream of all GMCP events for components
 * - Manages outgoing GMCP messages (delegates to SocketsService)
 * - Tracks active GMCP support configuration from the MUD
 * - Sends Core.Hello and Core.Supports.Set during GMCP handshake
 *
 * Architecture:
 * ```
 * MUD Server → Backend → Socket.IO → SocketsService → GmcpService → GmcpModuleHandler
 *                                                    ← sendOutgoing() ←
 * ```
 */
@Injectable({ providedIn: 'root' })
export class GmcpService {
  /** Registry of all active GMCP module handlers, keyed by module name */
  private readonly moduleRegistry = new Map<string, GmcpModuleHandler>();

  /** Function to send outgoing GMCP messages — injected by SocketsService */
  private sendFunction: GmcpSendFunction | null = null;

  /** Current GMCP support configuration (from mudGmcpStart) */
  private currentGmcpSupport: GmcpSupport | null = null;

  /** Whether GMCP is currently active for this connection */
  private active = false;

  /**
   * Observable stream of ALL incoming GMCP events.
   * Components can filter by module/message to react to specific events.
   *
   * @example
   * ```typescript
   * this.gmcpService.gmcpEvent$.pipe(
   *   filter(e => e.module === 'Char' && e.message === 'Name')
   * ).subscribe(event => { ... });
   * ```
   */
  public readonly gmcpEvent$ = new Subject<GmcpEvent>();

  /**
   * Emits when GMCP becomes active (after successful negotiation).
   * Carries the GmcpSupport configuration from the MUD family.
   */
  public readonly gmcpStart$ = new Subject<GmcpSupport>();

  /**
   * Sets the send function used to emit GMCP messages over Socket.IO.
   * Called once by SocketsService during its constructor.
   */
  public setSendFunction(fn: GmcpSendFunction): void {
    this.sendFunction = fn;
  }

  /**
   * Registers a GMCP module handler.
   * If a handler for the same module already exists, it is replaced
   * (the old handler's dispose() is called).
   *
   * @param handler - The module handler to register
   */
  public registerModule(handler: GmcpModuleHandler): void {
    const existing = this.moduleRegistry.get(handler.moduleName);

    if (existing !== undefined) {
      console.info(
        `[GMCP] Replacing existing handler for module: ${handler.moduleName}`,
      );

      existing.dispose?.();
    }

    this.moduleRegistry.set(handler.moduleName, handler);

    console.info(
      `[GMCP] Registered handler: ${handler.moduleName} v${handler.version}`,
    );
  }

  /**
   * Unregisters a GMCP module handler and calls its dispose() method.
   *
   * @param moduleName - The module name to unregister
   */
  public unregisterModule(moduleName: string): void {
    const handler = this.moduleRegistry.get(moduleName);

    if (handler !== undefined) {
      handler.dispose?.();
      this.moduleRegistry.delete(moduleName);

      console.info(`[GMCP] Unregistered handler: ${moduleName}`);
    }
  }

  /**
   * Handles an incoming GMCP message from the MUD server.
   * Called by SocketsService when a 'mudGmcpIncoming' event arrives.
   *
   * 1. Emits on the gmcpEvent$ observable (for any subscriber)
   * 2. Routes to the registered module handler (Strategy Pattern)
   *
   * @param module - Top-level module name (e.g. "Char")
   * @param message - Message within the module (e.g. "Status.Vitals")
   * @param data - Parsed JSON payload
   */
  public handleIncoming(module: string, message: string, data: unknown): void {
    const event: GmcpEvent = { module, message, data };

    // Broadcast to all observers
    this.gmcpEvent$.next(event);

    // Log MUD's Core.Hello response (contains MUD name/version)
    if (module === 'Core' && message === 'Hello') {
      console.info('[GMCP] MUD identifies as:', data);
    }

    // Route to specific module handler
    const handler = this.moduleRegistry.get(module);

    if (handler !== undefined) {
      handler.handleMessage(message, data);
    } else {
      console.debug(
        `[GMCP] No handler registered for module: ${module} (message: ${message})`,
      );
    }
  }

  /**
   * Sends an outgoing GMCP message to the MUD server.
   *
   * @param module - Top-level module name (e.g. "Core")
   * @param message - Message name (e.g. "Supports.Set")
   * @param data - Payload to send (will be JSON-encoded)
   */
  public sendOutgoing(module: string, message: string, data: unknown): void {
    if (this.sendFunction === null) {
      console.error(
        '[GMCP] Cannot send GMCP message: send function not set.',
      );

      return;
    }

    if (!this.active) {
      console.warn(
        `[GMCP] Cannot send GMCP message: GMCP is not active. (${module}.${message})`,
      );

      return;
    }

    console.debug(`[GMCP] Sending: ${module}.${message}`, data);

    this.sendFunction(module, message, data);
  }

  /**
   * Called when GMCP negotiation succeeds.
   * Stores the support configuration, sends the Core.Hello handshake,
   * and notifies subscribers.
   *
   * Handshake sequence: Core.Hello → Core.Supports.Set → gmcpStart$
   *
   * @param gmcpSupport - The GMCP module support config from the MUD family
   */
  public handleGmcpStart(gmcpSupport: GmcpSupport): void {
    this.currentGmcpSupport = gmcpSupport;
    this.active = true;

    console.info('[GMCP] GMCP started with support:', gmcpSupport);

    // Step 1: Identify client to MUD
    this.sendOutgoing('Core', 'Hello', {
      client: CLIENT_NAME,
      version: CLIENT_VERSION,
    });

    // Step 2: Announce supported modules
    this.sendCoreSupportsSet();

    // Step 3: Notify subscribers (handlers can now send their own messages)
    this.gmcpStart$.next(gmcpSupport);
  }

  /**
   * Sends `Core.Supports.Set` with all currently registered modules.
   * Called during GMCP start handshake.
   */
  private sendCoreSupportsSet(): void {
    const supportList = Array.from(this.moduleRegistry.values())
      .map(handler => `${handler.moduleName} ${handler.version}`);

    if (supportList.length > 0) {
      this.sendOutgoing('Core', 'Supports.Set', supportList);

      console.info('[GMCP] Core.Supports.Set sent:', supportList);
    }
  }

  /**
   * Resets GMCP state (e.g. on disconnect).
   * Disposes all registered handlers and clears the registry.
   */
  public reset(): void {
    for (const [, handler] of this.moduleRegistry) {
      handler.dispose?.();
    }

    this.moduleRegistry.clear();
    this.currentGmcpSupport = null;
    this.active = false;

    console.info('[GMCP] GMCP state reset.');
  }

  /** Whether GMCP is currently active */
  public get isActive(): boolean {
    return this.active;
  }

  /** Current GMCP support configuration, or null if not yet started */
  public get gmcpSupport(): GmcpSupport | null {
    return this.currentGmcpSupport;
  }

  /** Returns all registered module handlers (for menu building, etc.) */
  public getRegisteredModules(): ReadonlyMap<string, GmcpModuleHandler> {
    return this.moduleRegistry;
  }
}
