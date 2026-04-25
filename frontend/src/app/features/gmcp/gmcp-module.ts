import { Observable } from 'rxjs';

import type { GmcpMessage } from './gmcp.service';

/**
 * Describes a GMCP module support entry sent to the MUD server via Core.Supports.Set.
 * Example: { name: 'Char', version: 1 } -> "Char 1"
 */
export type GmcpModuleSupport = {
  /** Module name, e.g. "Char", "Sound", "Files" */
  name: string;
  /** Module version number */
  version: number;
};

/**
 * Interface for a GMCP module handler.
 *
 * Implement this interface to create a handler for specific GMCP packages.
 * Register it with `GmcpService.registerModule()` to receive messages
 * and have the module included in `Core.Supports.Set`.
 *
 * Example usage:
 * ```typescript
 * @Injectable({ providedIn: 'root' })
 * export class CharModule implements GmcpModule {
 *   readonly supports = [{ name: 'Char', version: 1 }];
 *
 *   handleMessage(message: GmcpMessage): void {
 *     switch (message.fullMessage) {
 *       case 'Char.Name':
 *         // handle character name update
 *         break;
 *       case 'Char.Vitals':
 *         // handle vitals update
 *         break;
 *     }
 *   }
 * }
 * ```
 */
export interface GmcpModule {
  /**
   * List of GMCP modules this handler supports.
   * These are sent to the MUD server via Core.Supports.Set when GMCP becomes active.
   */
  readonly supports: GmcpModuleSupport[];

  /**
   * Called for each incoming GMCP message whose packageName matches one
   * of the module names in `supports`.
   */
  handleMessage(message: GmcpMessage): void;

  /**
   * Optional: Called when GMCP becomes active (after Core.Hello handshake).
   * Use this for module-specific initialization (e.g., requesting initial data).
   */
  onActivate?(): void;

  /**
   * Optional: Called when GMCP is deactivated (MUD disconnect).
   * Use this to reset module state.
   */
  onDeactivate?(): void;
}
