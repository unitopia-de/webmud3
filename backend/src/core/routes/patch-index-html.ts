import fs from 'fs';
import path from 'path';

import { logger } from '../../shared/utils/logger.js';
import { Environment } from '../environment/environment.js';
import type { DistributionType } from '../environment/types/environment.js';

/**
 * Builds the deployment-specific index.html once and caches it. Every route
 * that delivers the SPA shell (the `/` + `/index.html` handlers AND the SPA
 * catch-all) MUST use this, so the bytes are identical no matter how the page
 * is reached. That matters for the PWA: the Service Worker caches whatever it
 * fetched for `/index.html`, and serves that for later navigations — if `/`
 * and `/index.html` were served unpatched (plain express.static) the installed
 * app would show the build-time title and miss the iOS meta tags.
 */
let cached: string | null = null;

/** Minimal HTML-escaping for text injected into the index.html markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Icon-filename base per distribution (the icons live in assets/icons/ and
 * follow `<base>-<size>.png`). Used for the iOS `apple-touch-icon` links so an
 * iPad shows the correct branding after "Add to Home Screen".
 */
const iconBaseByDistribution: Record<DistributionType, string> = {
  unitopia: 'unitopia-icon',
  seifenblase: 'sb-icon',
  default: 'icon',
};

export function getPatchedIndexHtml(): string {
  if (cached !== null) {
    return cached;
  }

  const env = Environment.getInstance();
  const indexPath = path.join(env.projectRoot, 'wwwroot/index.html');
  const raw = fs.readFileSync(indexPath, 'utf-8');

  // Replace the build-time `<base href="./">` with the deployment's configured
  // base path so the Angular router and document.baseURI reflect where the SPA
  // actually lives (e.g. `/webmud3test/` behind a reverse proxy).
  const withBaseHref = raw.replace(
    /<base\s+href="[^"]*"\s*\/?>/,
    `<base href="${env.baseHref}" />`,
  );

  // Replace the build-time `<title>` with the configured title (distribution
  // default, APP_TITLE overrides).
  const withTitle = withBaseHref.replace(
    /<title>[^<]*<\/title>/,
    `<title>${escapeHtml(env.appTitle)}</title>`,
  );

  // iOS Safari ignores most of the web manifest, so it needs its own tags for
  // a good "Add to Home Screen" experience. Distribution-dependent: icon set
  // and title differ per branding. The hrefs are relative (resolved against
  // <base href>), matching the manifest's icon paths.
  const iconBase = iconBaseByDistribution[env.distributionType];
  const iosTags = [
    `<link rel="apple-touch-icon" sizes="192x192" href="assets/icons/${iconBase}-192x192.png" />`,
    `<link rel="apple-touch-icon" sizes="152x152" href="assets/icons/${iconBase}-152x152.png" />`,
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
    `<meta name="apple-mobile-web-app-title" content="${escapeHtml(env.appTitle)}" />`,
    '<meta name="mobile-web-app-capable" content="yes" />',
  ].join('\n    ');
  const withIos = withTitle.replace('</head>', `    ${iosTags}\n  </head>`);

  logger.info(
    `[Index] index.html patched (baseHref=${env.baseHref}, appTitle=${env.appTitle}, distribution=${env.distributionType})`,
  );

  cached = withIos;
  return cached;
}
