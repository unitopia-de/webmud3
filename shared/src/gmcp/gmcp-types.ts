/**
 * Configuration for a single GMCP module as declared by a MUD family.
 */
export interface GmcpModuleConfig {
  /** Version string of the module (e.g. "1") */
  version: string;
  /** Whether this module is part of the standard GMCP set */
  standard: boolean;
  /** Whether the module is optional (can be toggled by the user) */
  optional: boolean;
}

/**
 * Map of GMCP module names to their configuration.
 * Used to declare which GMCP modules a MUD family supports.
 *
 * @example
 * {
 *   "Core": { version: "1", standard: true, optional: false },
 *   "Char": { version: "1", standard: true, optional: false },
 *   "Sound": { version: "1", standard: false, optional: true },
 * }
 */
export interface GmcpSupport {
  [moduleName: string]: GmcpModuleConfig;
}

/**
 * Configuration for a MUD family (e.g. "unitopia", "seifenblase").
 * Defines protocol capabilities shared by all MUDs of the same family.
 */
export interface MudFamilyConfig {
  /** Character encoding to use (e.g. "UTF-8") */
  charset: string;
  /** Whether MXP (Mud eXtension Protocol) is supported */
  MXP: boolean;
  /** Whether GMCP (Generic MUD Communication Protocol) is supported */
  GMCP: boolean;
  /** Detailed GMCP module support configuration */
  GMCP_Support: GmcpSupport;
}

/**
 * Configuration for a single MUD server.
 */
export interface MudConfig {
  /** Display name of the MUD */
  name: string;
  /** Hostname or IP address */
  host: string;
  /** Telnet port number */
  port: number;
  /** Whether to use TLS/SSL for the telnet connection */
  ssl: boolean;
  /** Whether to reject self-signed TLS certificates */
  rejectUnauthorized: boolean;
  /** Human-readable description */
  description: string;
  /** Required player level for access (e.g. "spieler", "magier") */
  playerlevel: string;
  /** Reference to the MUD family key (e.g. "unitopia") */
  mudfamily: string;
}

/**
 * Root structure of the mud_config.json file.
 * Contains all MUD families, individual MUDs, and URL route mappings.
 */
export interface MudConfigFile {
  /** Configuration scope identifier */
  scope: string;
  /** Base URL / href for the deployment */
  href: string;
  /** Map of family keys to their configurations */
  mudfamilies: Record<string, MudFamilyConfig>;
  /** Map of MUD identifiers to their server configurations */
  muds: Record<string, MudConfig>;
  /** Map of URL routes to MUD identifiers */
  routes: Record<string, string>;
}
