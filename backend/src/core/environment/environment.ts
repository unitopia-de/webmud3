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
  public readonly tls?: {
    cert: string;
    key: string;
  };
  public readonly charset: string;
  public readonly projectRoot: string;
  public readonly socketRoot: string;
  public readonly socketTimeout: number;

  /**
   * Private constructor to enforce singleton pattern.
   * Initializes the environment variables.
   */
  private constructor() {
    configureEnvironment();

    const tls_cert = getEnvironmentVariable('TLS_CERT', false);

    const tls_key = getEnvironmentVariable('TLS_KEY', false);

    if (tls_cert !== null && tls_key !== null) {
      this.tls = {
        cert: tls_cert,
        key: tls_key,
      };
    }

    this.host = String(getEnvironmentVariable('HOST', false, '0.0.0.0'));

    this.port = Number(getEnvironmentVariable('PORT', false, '5000'));

    this.telnetHost = String(getEnvironmentVariable('TELNET_HOST'));

    this.telnetPort = Number(getEnvironmentVariable('TELNET_PORT'));

    this.telnetTLS =Boolean(getEnvironmentVariable('TELNET_TLS',false,'false'));

    this.charset = String(getEnvironmentVariable('CHARSET', false, 'utf8'));

    this.socketTimeout = Number(
      getEnvironmentVariable('SOCKET_TIMEOUT', false, '900000'),
    );

    this.projectRoot = resolveModulePath('../../../main.js');

    this.socketRoot = String(getEnvironmentVariable('SOCKET_ROOT',false,'/socket.io'));

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
