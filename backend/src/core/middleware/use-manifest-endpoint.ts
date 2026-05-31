import { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

import { logger } from '../../shared/utils/logger.js';
import { Environment } from '../environment/environment.js';

/**
 * Serves the PWA manifest at `/manifest.webmanifest`, picking the file that
 * matches the deployment's `WEBMUD3_DISTRIBUTION_TYPE` (Unitopia / Seifenblase
 * / default). The frontend's `<link rel="manifest" href="manifest.webmanifest">`
 * stays unchanged — the same path always works, but the bytes differ per
 * distribution (different name / icon set).
 *
 * Why a dedicated route instead of `express.static`: the served file depends
 * on a runtime env var, not on the request path, so a single image can serve
 * either branding. This MUST be registered BEFORE `useStaticFiles` so it wins
 * over the static handler for `/manifest.webmanifest`.
 *
 * Fallback chain (first existing file wins):
 *   manifest.<distribution>.webmanifest → manifest.default.webmanifest →
 *   manifest.webmanifest
 *
 * The chosen content is cached in memory after the first hit. `Cache-Control:
 * no-store` so installed PWAs pick up branding/name changes after a redeploy.
 */
let cachedManifest: { body: string } | null = null;

function loadManifest(): string {
  const env = Environment.getInstance();
  const wwwroot = path.join(env.projectRoot, 'wwwroot');

  const candidates = [
    `manifest.${env.distributionType}.webmanifest`,
    'manifest.default.webmanifest',
    'manifest.webmanifest',
  ];

  for (const name of candidates) {
    const candidatePath = path.join(wwwroot, name);
    if (fs.existsSync(candidatePath)) {
      logger.info(
        `[Manifest] Serving ${name} for distribution "${env.distributionType}"`,
      );
      return fs.readFileSync(candidatePath, 'utf-8');
    }
  }

  logger.error(
    `[Manifest] No manifest file found in ${wwwroot} (tried: ${candidates.join(', ')})`,
  );
  return '';
}

export const useManifestEndpoint = (app: Express) => {
  app.get('/manifest.webmanifest', (_req: Request, res: Response) => {
    if (cachedManifest === null) {
      cachedManifest = { body: loadManifest() };
    }

    if (!cachedManifest.body) {
      res.sendStatus(404);
      return;
    }

    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(cachedManifest.body);
  });
};
