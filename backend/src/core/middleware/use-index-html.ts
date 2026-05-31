import { Express, Request, Response } from 'express';

import { logger } from '../../shared/utils/logger.js';
import { getPatchedIndexHtml } from '../routes/patch-index-html.js';

/**
 * Serves the patched SPA shell for `/` and `/index.html`. MUST be registered
 * BEFORE useStaticFiles so express.static doesn't serve the raw, unpatched
 * build file for these paths.
 *
 * Why both paths matter: the browser hits `/`, but the Angular Service Worker
 * prefetches `/index.html` (its configured `index`) and serves that cached
 * copy for every later navigation. Both must therefore carry the deployment's
 * base href, title and iOS meta tags — otherwise the installed PWA falls back
 * to the build-time shell.
 */
export const useIndexHtml = (app: Express) => {
  const handler = (_req: Request, res: Response) => {
    try {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.type('html').send(getPatchedIndexHtml());
    } catch (err) {
      logger.error('[IndexHtml] Failed to send index.html', {
        error: err instanceof Error ? err.message : String(err),
      });
      res.sendStatus(500);
    }
  };

  app.get('/', handler);
  app.get('/index.html', handler);
};
