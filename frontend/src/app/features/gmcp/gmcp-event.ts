/**
 * Represents a single GMCP event flowing through the system.
 * Used as the payload for the GmcpService's observable stream.
 */
export interface GmcpEvent {
  /** Top-level module name (e.g. "Core", "Char", "Sound") */
  module: string;
  /** Message name within the module (e.g. "Hello", "Status.Vitals") */
  message: string;
  /** Parsed JSON payload from the MUD */
  data: unknown;
}
