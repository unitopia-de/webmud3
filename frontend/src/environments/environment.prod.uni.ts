import { Environment } from './environment.interface';

/**
 * UNItopia production environment.
 *
 * Deployed at https://www.unitopia.de/webmud3/
 * Backend is reverse-proxied by Apache on the same origin.
 * The backend URL is derived from the current page location:
 * - origin: https://www.unitopia.de
 * - Socket.IO path is configured server-side via /api/config
 */
export const environment: Environment = {
  production: true,
  backendUrl: () => window.location.origin,
};
