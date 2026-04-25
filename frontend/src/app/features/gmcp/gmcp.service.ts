import { inject, Injectable, OnDestroy } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  Subject,
  Subscription,
  filter,
} from 'rxjs';

import { SocketsService } from '../sockets/sockets.service';
import type { GmcpModule, GmcpModuleSupport } from './gmcp-module';

/**
 * A parsed GMCP message as received from the MUD server.
 */
export type GmcpMessage = {
  /** The GMCP package, e.g. "Char" from "Char.Name" */
  packageName: string;
  /** The GMCP message name, e.g. "Name" from "Char.Name" */
  messageName: string;
  /** The full module string, e.g. "Char.Name" */
  fullMessage: string;
  /** The parsed JSON data payload */
  data: unknown;
};

/** Client info sent with Core.Hello */
const CLIENT_INFO = {
  client: 'WebMud3',
  version: '1.0.0-alpha',
};

@Injectable({ providedIn: 'root' })
export class GmcpService implements OnDestroy {
  private readonly sockets = inject(SocketsService);

  private readonly active = new BehaviorSubject<boolean>(false);
  private readonly messages = new Subject<GmcpMessage>();
  private readonly subscriptions: Subscription[] = [];

  /**
   * Registry: maps package name (e.g. "Char") to its GmcpModule handler.
   * A single GmcpModule may handle multiple packages via its `supports` array.
   */
  private readonly registry = new Map<string, GmcpModule>();

  /** All registered modules (for lifecycle management) */
  private readonly modules = new Set<GmcpModule>();

  /** Whether GMCP is currently active (negotiated with MUD server) */
  public readonly active$ = this.active.asObservable();

  /** Stream of all incoming GMCP messages */
  public readonly messages$ = this.messages.asObservable();

  constructor() {
    this.subscriptions.push(
      this.sockets.onGmcpActive.subscribe((isActive) => {
        const wasActive = this.active.value;

        this.active.next(isActive);

        if (isActive && !wasActive) {
          this.handleActivation();
        } else if (!isActive && wasActive) {
          this.handleDeactivation();
        }
      }),
    );

    this.subscriptions.push(
      this.sockets.onGmcpIncoming.subscribe(
        ({ packageName, messageName, data }) => {
          const message: GmcpMessage = {
            packageName,
            messageName,
            fullMessage: `${packageName}.${messageName}`,
            data,
          };

          // Route to registered module handler
          const handler = this.registry.get(packageName);

          if (handler) {
            handler.handleMessage(message);
          }

          // Also emit on the global stream for ad-hoc subscribers
          this.messages.next(message);
        },
      ),
    );
  }

  ngOnDestroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }

  // ---------------------------------------------------------------------------
  // Module Registry
  // ---------------------------------------------------------------------------

  /**
   * Registers a GMCP module handler.
   * The module's `supports` entries are used to:
   * - Route incoming GMCP messages to the handler
   * - Include the modules in `Core.Supports.Set` sent to the MUD server
   *
   * If GMCP is already active, sends an incremental `Core.Supports.Set`
   * and calls `onActivate()` immediately.
   */
  public registerModule(module: GmcpModule): void {
    this.modules.add(module);

    for (const support of module.supports) {
      if (this.registry.has(support.name)) {
        console.warn(
          `[GMCP] Module "${support.name}" is already registered — overwriting`,
        );
      }

      this.registry.set(support.name, module);
    }

    // If GMCP is already active, send incremental support and activate
    if (this.active.value) {
      this.sendSupportsSet(module.supports);
      module.onActivate?.();
    }
  }

  /**
   * Unregisters a GMCP module handler.
   * Sends `Core.Supports.Remove` to the MUD server if GMCP is active.
   */
  public unregisterModule(module: GmcpModule): void {
    module.onDeactivate?.();
    this.modules.delete(module);

    const toRemove: string[] = [];

    for (const support of module.supports) {
      if (this.registry.get(support.name) === module) {
        this.registry.delete(support.name);

        toRemove.push(`${support.name} ${support.version}`);
      }
    }

    if (this.active.value && toRemove.length > 0) {
      this.sockets.sendGmcp('Core.Supports.Remove', toRemove);
    }
  }

  /**
   * Returns all currently registered module support entries.
   */
  public getRegisteredSupports(): GmcpModuleSupport[] {
    const supports: GmcpModuleSupport[] = [];

    for (const module of this.modules) {
      supports.push(...module.supports);
    }

    return supports;
  }

  // ---------------------------------------------------------------------------
  // Message API
  // ---------------------------------------------------------------------------

  /**
   * Returns an Observable that emits only GMCP messages matching the given full module string.
   * Example: `onMessage('Char.Name')` emits when the server sends `Char.Name {...}`.
   */
  public onMessage(fullMessage: string): Observable<GmcpMessage> {
    return this.messages$.pipe(
      filter((msg) => msg.fullMessage === fullMessage),
    );
  }

  /**
   * Returns an Observable that emits all GMCP messages for a given package.
   * Example: `onPackage('Char')` emits for `Char.Name`, `Char.Status`, `Char.Vitals`, etc.
   */
  public onPackage(packageName: string): Observable<GmcpMessage> {
    return this.messages$.pipe(
      filter((msg) => msg.packageName === packageName),
    );
  }

  /**
   * Sends a GMCP message to the MUD server.
   * @param module - The GMCP module string, e.g. "Core.Hello"
   * @param data - The data payload (will be JSON-serialized)
   */
  public send(module: string, data: unknown = undefined): void {
    if (!this.active.value) {
      console.warn('[GMCP] Cannot send GMCP message - not active');
      return;
    }

    this.sockets.sendGmcp(module, data);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Called when GMCP becomes active. Sends Core.Hello, then Core.Supports.Set
   * with all registered modules, then notifies each module.
   */
  private handleActivation(): void {
    console.info('[GMCP] GMCP activated — sending handshake');

    // 1. Core.Hello
    this.sockets.sendGmcp('Core.Hello', CLIENT_INFO);

    // 2. Core.Supports.Set with all registered modules
    const allSupports = this.getRegisteredSupports();

    if (allSupports.length > 0) {
      this.sendSupportsSet(allSupports);
    }

    // 3. Notify all modules
    for (const module of this.modules) {
      module.onActivate?.();
    }
  }

  /**
   * Called when GMCP is deactivated. Notifies all modules.
   */
  private handleDeactivation(): void {
    console.info('[GMCP] GMCP deactivated');

    for (const module of this.modules) {
      module.onDeactivate?.();
    }
  }

  /**
   * Sends Core.Supports.Set with the given module support entries.
   */
  private sendSupportsSet(supports: GmcpModuleSupport[]): void {
    const supportStrings = supports.map((s) => `${s.name} ${s.version}`);

    this.sockets.sendGmcp('Core.Supports.Set', supportStrings);
  }
}
