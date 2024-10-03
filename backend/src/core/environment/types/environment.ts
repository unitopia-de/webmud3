export interface IEnvironment {
  readonly telnetHost: string;
  readonly telnetPort: number;
  readonly telnetTLS: boolean;

  readonly projectRoot: string;
  readonly socketRoot: string;

  readonly socketTimeout: number;

  readonly environment: 'production' | 'development';
}
