import { Environment } from './environment.interface';

/**
 * Seifenblase production environment.
 *
 * Deployed at https://seife.mud.de/webmud3/
 * Backend is reverse-proxied by Apache on the same origin.
 * The backend URL is derived from the current page location.
 */
export const environment: Environment = {
  production: true,
  backendUrl: () => window.location.origin,
};
