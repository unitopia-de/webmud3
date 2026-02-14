import fs from 'fs';
import path from 'path';

import type {
  GmcpSupport,
  MudConfig,
  MudConfigFile,
  MudFamilyConfig,
} from '@webmud3/shared';

import { logger } from '../../shared/utils/logger.js';

/**
 * Resolved connection parameters for a single MUD.
 * Used by SocketManager to create the TelnetClient.
 */
export interface ResolvedMudConnection {
  /** Telnet hostname */
  host: string;
  /** Telnet port */
  port: number;
  /** Whether to use TLS */
  ssl: boolean;
  /** MUD family key (e.g. "unitopia") */
  mudfamily: string;
  /** Display name */
  name: string;
}

/**
 * Service for loading and querying the multi-MUD configuration.
 *
 * Design decisions per user requirements:
 * 1. The config file path is set via the optional `MUD_CONFIG_PATH` env variable
 * 2. If the env variable is not set OR the file doesn't exist, the service
 *    reports `isAvailable = false` and all lookups fall through to the
 *    existing TELNET_HOST/PORT environment variables (no error, no crash)
 */
export class MudConfigService {
  private static instance: MudConfigService;

  private readonly config: MudConfigFile | null;

  private constructor(configPath: string | null) {
    this.config = this.loadConfig(configPath);
  }

  /**
   * Initializes and returns the singleton instance.
   *
   * @param configPath - Path to mud_config.json (from `Environment.mudConfigPath`)
   */
  public static getInstance(configPath: string | null): MudConfigService {
    return this.instance || (this.instance = new this(configPath));
  }

  /** Whether a valid MUD config file was loaded */
  public get isAvailable(): boolean {
    return this.config !== null;
  }

  /** Returns the full loaded config, or null */
  public get rawConfig(): MudConfigFile | null {
    return this.config;
  }

  /**
   * Returns the MUD server configuration for a given MUD ID.
   *
   * @returns MudConfig or undefined if not found / config not loaded
   */
  public getMudById(mudId: string): MudConfig | undefined {
    return this.config?.muds[mudId];
  }

  /**
   * Returns the MUD family configuration for a given family key.
   *
   * @returns MudFamilyConfig or undefined if not found / config not loaded
   */
  public getMudFamily(familyKey: string): MudFamilyConfig | undefined {
    return this.config?.mudfamilies[familyKey];
  }

  /**
   * Returns the GMCP support configuration for a given MUD ID.
   * Resolves the MUD → family → GMCP_Support chain.
   *
   * @returns GmcpSupport or undefined if MUD/family not found or GMCP not supported
   */
  public getGmcpSupport(mudId: string): GmcpSupport | undefined {
    const mud = this.getMudById(mudId);

    if (mud === undefined) {
      return undefined;
    }

    const family = this.getMudFamily(mud.mudfamily);

    if (family === undefined || !family.GMCP) {
      return undefined;
    }

    return family.GMCP_Support;
  }

  /**
   * Resolves the connection parameters for a given MUD ID.
   *
   * @returns ResolvedMudConnection or undefined if not found
   */
  public resolveConnection(mudId: string): ResolvedMudConnection | undefined {
    const mud = this.getMudById(mudId);

    if (mud === undefined) {
      return undefined;
    }

    return {
      host: mud.host,
      port: mud.port,
      ssl: mud.ssl,
      mudfamily: mud.mudfamily,
      name: mud.name,
    };
  }

  /**
   * Returns a sanitized MUD list suitable for the frontend (REST API).
   * Excludes sensitive data and returns only what the frontend needs.
   */
  public getMudList(): Record<
    string,
    { name: string; description: string; mudfamily: string }
  > {
    if (this.config === null) {
      return {};
    }

    const result: Record<
      string,
      { name: string; description: string; mudfamily: string }
    > = {};

    for (const [id, mud] of Object.entries(this.config.muds)) {
      result[id] = {
        name: mud.name,
        description: mud.description,
        mudfamily: mud.mudfamily,
      };
    }

    return result;
  }

  /**
   * Returns the route mappings from the config (URL path → MUD ID).
   */
  public getRoutes(): Record<string, string> {
    return this.config?.routes ?? {};
  }

  /**
   * Attempts to load and parse the mud_config.json file.
   * Returns null (with a log message) if the file cannot be loaded.
   */
  private loadConfig(configPath: string | null): MudConfigFile | null {
    if (configPath === null || configPath.trim().length === 0) {
      logger.info(
        '[MudConfigService] MUD_CONFIG_PATH not set. Using TELNET_HOST/PORT env variables as fallback.',
      );

      return null;
    }

    const resolvedPath = path.resolve(configPath);

    if (!fs.existsSync(resolvedPath)) {
      logger.warn(
        `[MudConfigService] Config file not found: ${resolvedPath}. Using TELNET_HOST/PORT env variables as fallback.`,
      );

      return null;
    }

    try {
      const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
      const parsed = JSON.parse(rawContent) as MudConfigFile;

      const mudCount = Object.keys(parsed.muds ?? {}).length;
      const familyCount = Object.keys(parsed.mudfamilies ?? {}).length;

      logger.info(
        `[MudConfigService] Loaded config from ${resolvedPath}: ${mudCount} MUDs, ${familyCount} families`,
      );

      return parsed;
    } catch (error) {
      logger.error(
        `[MudConfigService] Failed to load config from ${resolvedPath}. Using TELNET_HOST/PORT env variables as fallback.`,
        { error },
      );

      return null;
    }
  }
}
