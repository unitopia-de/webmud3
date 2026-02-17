export interface IEnvironment {
  readonly telnetHost: string;
  readonly telnetPort: number;
  readonly telnetTLS: boolean;
  readonly name: string;
  readonly projectRoot: string;
  readonly socketRoot: string;
  readonly socketPingInterval: number;
  readonly socketPingTimeout: number;
  readonly socketTimeout: number;
  readonly telnetKeepAliveDelay: number;
  readonly environment: 'production' | 'development';
  readonly corsAllowList: string[];
  /** Optional path to mud_config.json for Multi-MUD support */
  readonly mudConfigPath: string | null;
}
