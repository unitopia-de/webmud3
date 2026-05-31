/**
 * Branding variant served per deployment. Drives the PWA manifest, icon set
 * and default application title.
 */
export type DistributionType = 'unitopia' | 'seifenblase' | 'default';

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
  readonly baseHref: string;
  readonly appTitle: string;
  readonly distributionType: DistributionType;
}
