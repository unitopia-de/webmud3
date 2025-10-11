import { config as configureEnvironment } from 'dotenv';

import { logger } from '../../shared/utils/logger.js';
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

  /**
   * Private constructor to enforce singleton pattern.
   * Initializes the environment variables.
   */
  private constructor() {
    configureEnvironment();

    this.host = String(getEnvironmentVariable('HOST', false, '0.0.0.0'));

    this.port = Number(getEnvironmentVariable('PORT', false, '5000'));

    this.telnetHost = String(getEnvironmentVariable('TELNET_HOST'));

    this.telnetPort = Number(getEnvironmentVariable('TELNET_PORT'));

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

    const corsAllowList = getEnvironmentVariable(
      'CORS_ALLOWED_ORIGINS',
      false,
    );

    this.corsAllowList =
      corsAllowList === null
        ? []
        : corsAllowList
            .split(',')
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0);

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
