/**
 * Represents a single menu item that a GMCP module can contribute.
 * Used by modules like Sound to add toggle entries to the application menu.
 */
export interface GmcpMenuItem {
  /** Display label for the menu item */
  label: string;
  /** Icon identifier (optional) */
  icon?: string;
  /** Tooltip text */
  tooltip?: string;
  /** Action to execute when clicked */
  action: () => void;
  /** Whether the item is currently checked/active */
  checked?: boolean;
}

/**
 * Strategy interface for GMCP module handlers.
 *
 * Each GMCP module (Sound, Char, Files, etc.) implements this interface.
 * The GmcpService uses it to route incoming messages to the correct handler
 * and to manage module lifecycle.
 *
 * This is the core of the Strategy Pattern: instead of hard-coding
 * `if (module === 'Sound')` checks, each module registers a handler
 * that encapsulates its behavior.
 */
export interface GmcpModuleHandler {
  /** GMCP module name as registered with the MUD (e.g. "Sound", "Char", "Files") */
  readonly moduleName: string;

  /** GMCP module version (e.g. "1") */
  readonly version: string;

  /**
   * Called when a GMCP message for this module arrives from the MUD.
   *
   * @param message - The message name within the module (e.g. "Url", "Status")
   * @param data - The parsed JSON payload
   */
  handleMessage(message: string, data: unknown): void;

  /**
   * Optional: Returns menu items contributed by this module.
   * Called by the MenuService (Phase 2.2) to build the dynamic menu.
   */
  getMenuItems?(): GmcpMenuItem[];

  /**
   * Optional: Called when the module is being unregistered.
   * Use for cleanup (unsubscribe observables, etc.).
   */
  dispose?(): void;
}
