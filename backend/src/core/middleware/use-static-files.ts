import express, { Express } from 'express';
import path from 'path';

import { logger } from '../../shared/utils/logger.js';
import { Environment } from '../environment/environment.js';

/**
 * Files that control the Service Worker / app shell and must never sit in the
 * HTTP cache — otherwise installed PWAs never see new releases.
 */
const NO_STORE_FILES = new Set([
  'ngsw-worker.js',
  'ngsw.json',
  'safety-worker.js',
  'worker-basic.min.js',
  'index.html',
  'manifest.webmanifest',
]);

/** Matches Angular's content-hashed bundle names (e.g. `main-AB12CD34.js`). */
const HASHED_ASSET = /-[0-9A-Z]{8,}\.(js|css|woff2?|png|svg|jpg|jpeg|webp|ico)$/i;

export const useStaticFiles = (app: Express, folder: string) => {
  const assetPath = path.join(Environment.getInstance().projectRoot, folder);

  logger.info(
    `[Middleware] [Static-Files] Serving static files from ${assetPath}`,
  );

  app.use(
    express.static(assetPath, {
      setHeaders: (res, filePath) => {
        const name = path.basename(filePath);

        // SW control files + app shell: never cache.
        if (NO_STORE_FILES.has(name) || name.endsWith('.webmanifest')) {
          res.setHeader(
            'Cache-Control',
            'no-cache, no-store, must-revalidate',
          );
          return;
        }

        // Content-hashed bundles/assets are immutable — cache for a year.
        if (HASHED_ASSET.test(name)) {
          res.setHeader(
            'Cache-Control',
            'public, max-age=31536000, immutable',
          );
        }
      },
    }),
  );
};
