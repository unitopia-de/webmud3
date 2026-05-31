import { Express, Request, Response } from 'express';

// import authRoutes from '../../features/auth/auth-routes.js';
import { logger } from '../../shared/utils/logger.js';
import { getPatchedIndexHtml } from './patch-index-html.js';

export const useRoutes = (app: Express) => {
  // app.use('/api/auth', authRoutes);

  // Note: `/manifest.webmanifest` is handled by useManifestEndpoint and `/` +
  // `/index.html` by useIndexHtml — both registered BEFORE express.static in
  // main.ts. This catch-all only handles SPA deep links (e.g. /ez, /hilfe),
  // for which express.static finds no file. All three deliver the SAME patched
  // shell via getPatchedIndexHtml().

  app.get('/*path', (req: Request, res: Response) => {
    logger.info(`[Routes] requested * - delivering index.html`);

    try {
      // The SPA shell must never sit in the HTTP cache — otherwise installed
      // browsers see stale `<base href>` / asset hashes after a redeploy.
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.type('html').send(getPatchedIndexHtml());
    } catch (err) {
      logger.error('[Routes] Failed to send index.html', {
        error: err instanceof Error ? err.message : String(err),
        path: req.path,
      });

      res.sendStatus(500);
    }
  });
};
