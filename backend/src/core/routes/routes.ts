import { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

// import authRoutes from '../../features/auth/auth-routes.js';
import { logger } from '../../shared/utils/logger.js';
import { Environment } from '../environment/environment.js';

/**
 * Caches the patched index.html so the catch-all handler doesn't have to
 * touch the filesystem on every request. Loaded lazily on the first hit
 * — Environment must be initialised before this runs.
 */
let cachedIndexHtml: string | null = null;

/** Minimal HTML-escaping for text injected into the index.html markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function loadAndPatchIndexHtml(): string {
  const env = Environment.getInstance();
  const indexPath = path.join(env.projectRoot, 'wwwroot/index.html');

  const raw = fs.readFileSync(indexPath, 'utf-8');

  // Replace the build-time `<base href="./" />` with the deployment's
  // configured base path so the Angular router and document.baseURI
  // both reflect where the SPA actually lives (e.g. `/webmud3/` when
  // hosted behind a reverse proxy under that prefix).
  const withBaseHref = raw.replace(
    /<base\s+href="[^"]*"\s*\/?>/,
    `<base href="${env.baseHref}" />`,
  );

  // Replace the build-time `<title>` with the deployment's configured title
  // so the browser tab shows it. The frontend reads the same value from
  // /api/config (e.g. for the PWA manifest later). escapeHtml guards against
  // a `<`/`&` in the title breaking the markup.
  const patched = withBaseHref.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(env.appTitle)}</title>`,
  );

  logger.info(
    `[Routes] index.html patched with baseHref=${env.baseHref}, appTitle=${env.appTitle}`,
  );

  return patched;
}

export const useRoutes = (app: Express) => {
  // app.use('/api/auth', authRoutes);

  app.get('/manifest.webmanifest', function (req: Request, res: Response) {
    logger.info(`[Routes] requested manifest.webmanifest`);

    fs.readFile(
      path.join(__dirname, 'dist', 'manifest.webmanifest'),
      function (err, data) {
        if (err) {
          logger.error('[Routes] Failed to read manifest.webmanifest', {
            error: err.message,
            path: path.join(__dirname, 'dist', 'manifest.webmanifest'),
          });

          res.sendStatus(404);
        } else {
          res.send(data);
        }
      },
    );
  });

  // app.get('/ace/*', (req: Request, res: Response) => {
  //   const ip =
  //     req.headers['x-forwarded-for'] ||
  //     req.connection.remoteAddress ||
  //     req.socket.remoteAddress ||
  //     (req.socket ? req.socket.remoteAddress : null);

  //   const mypath = req.path.substr(5);

  //   logger.debug('ACE Path:', { real_ip: ip, path: mypath });

  //   res.sendFile(
  //     path.join(
  //       __dirname,
  //       'node_modules/ace-builds/src-min-noconflict/' + mypath,
  //     ),
  //   );
  // });

  app.get('/*path', (req: Request, res: Response) => {
    logger.info(`[Routes] requested * - delivering index.html`);

    try {
      if (cachedIndexHtml === null) {
        cachedIndexHtml = loadAndPatchIndexHtml();
      }

      // The SPA shell must never sit in the HTTP cache — otherwise installed
      // browsers see stale `<base href>` / asset hashes after a redeploy.
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.type('html').send(cachedIndexHtml);
    } catch (err) {
      logger.error('[Routes] Failed to send index.html', {
        error: err instanceof Error ? err.message : String(err),
        path: req.path,
      });

      res.sendStatus(500);
    }
  });
};
