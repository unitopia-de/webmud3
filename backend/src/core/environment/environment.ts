import { config as configureEnvironment } from 'dotenv';

import { logger, setLogLevel } from '../../shared/utils/logger.js';
import { IEnvironment } from './types/environment.js';
import { getEnvironmentVariable } from './utils/get-environment-variable.js';
import { resolveModulePath } from './utils/resolve-modulepath.js';

/**
 * Environment class to handle environment variables and application settings.
 * Reads the environment variables once oppon initialisation and provides them as properties.
 */
export class Environment implements IEnvironment {
  private static instance: Environment;

  public readonly host: string;
  public readonly port: number;
  public readonly telnetHost: string;
  public readonly telnetPort: number;
  public readonly telnetTLS: boolean;
  public readonly projectRoot: string;
  public readonly socketRoot: string;
  public readonly socketTimeout: number;
  public readonly environment: 'production' | 'development';
  public readonly name: string;
  public readonly corsAllowList: string[];
  public readonly logLevel: string;
  public readonly mudConfigPath: string | null;

  /**
   * Private constructor to enforce singleton pattern.
   * Initializes the environment variables.
   */
  private constructor() {
    configureEnvironment({ quiet: true });

    this.host = String(getEnvironmentVariable('HOST', false, '0.0.0.0'));

    this.port = Number(getEnvironmentVariable('PORT', false, '5000'));

    this.mudConfigPath =
      getEnvironmentVariable('MUD_CONFIG_PATH', false) ?? null;

    // TELNET_HOST/PORT are fallback defaults when no MUD_CONFIG_PATH is set.
    // When a mud_config.json is used, individual MUDs define their own host/port.
    this.telnetHost = String(
      getEnvironmentVariable('TELNET_HOST', false, 'localhost'),
    );

    this.telnetPort = Number(
      getEnvironmentVariable('TELNET_PORT', false, '23'),
    );

    this.telnetTLS =
      getEnvironmentVariable(
        'TELNET_TLS',
        false,
        'false',
      )?.toLocaleLowerCase() === 'true';

    this.socketRoot = String(getEnvironmentVariable('SOCKET_ROOT'));

    this.socketTimeout = Number(
      getEnvironmentVariable('SOCKET_TIMEOUT', false, '900000'),
    );

    const environment = String(
      getEnvironmentVariable('ENVIRONMENT', false, 'production'),
    ).toLocaleLowerCase();

    if (environment !== 'production' && environment !== 'development') {
      throw new Error(
        'Environment variable "ENVIRONMENT" must be either "production" or "development" or unset.',
      );
    }

    this.environment = environment;

    this.projectRoot = resolveModulePath('../../../main.js');

    this.name = String(getEnvironmentVariable('NAME', false, 'webmud3b'));

    const corsAllowList = getEnvironmentVariable('CORS_ALLOWED_ORIGINS', false);

    this.corsAllowList =
      corsAllowList === null
        ? []
        : corsAllowList
            .split(',')
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0);

    this.logLevel = String(getEnvironmentVariable('LOG_LEVEL', false, 'debug'));

    setLogLevel(this.logLevel);

    logger.info('[Environment] initialized', this);
  }

  /**
   * Gets the singleton instance of the Environment class.
   * @returns {Environment} The instance of the Environment class.
   */
  public static getInstance(): Environment {
    return this.instance || (this.instance = new this());
  }
}
