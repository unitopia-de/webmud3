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
        `[Manifest] Serving ${name} for distribution "${env.distributionType}" (name="${env.appTitle}")`,
      );
      const raw = fs.readFileSync(candidatePath, 'utf-8');
      return applyAppTitle(raw, env.appTitle);
    }
  }

  logger.error(
    `[Manifest] No manifest file found in ${wwwroot} (tried: ${candidates.join(', ')})`,
  );
  return '';
}

/**
 * Overrides the manifest's `name` and `short_name` with the deployment's
 * APP_TITLE so two installs of the SAME distribution but different deployments
 * (e.g. `/webmud3/` vs `/webmud3test/`) get distinguishable PWA names without
 * needing separate manifest files. The icon set still comes from the
 * distribution-specific file.
 */
function applyAppTitle(rawJson: string, appTitle: string): string {
  if (!appTitle) {
    return rawJson;
  }
  try {
    const manifest = JSON.parse(rawJson) as Record<string, unknown>;
    manifest['name'] = appTitle;
    manifest['short_name'] = appTitle;
    return JSON.stringify(manifest, null, 2);
  } catch (err) {
    logger.error('[Manifest] Failed to parse manifest JSON, serving raw', {
      error: err instanceof Error ? err.message : String(err),
    });
    return rawJson;
  }
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
