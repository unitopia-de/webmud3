import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  // `document.baseURI` reflects whatever the server-rendered <base href>
  // was set to. The backend patches that <base href> with the BASE_HREF
  // env-var so the SPA can be deployed at the origin or under a subpath
  // (e.g. https://www.unitopia.de/webmud3/) without rebuilding the image.
  // Trailing slash is stripped so callers can append "/api/..." cleanly.
  backendUrl: () => document.baseURI.replace(/\/$/, ''),
};
