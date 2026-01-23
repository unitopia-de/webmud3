import { Express } from 'express';
import fs from 'fs';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';

import { logger } from './logger.js';

// Todo[myst]: Ich will das eigentlich nicht hier haben, da man nicht beliebig in der Anwendung einfach mal http Server spawnen können sollte
export function createHttpServer(
  app: Express,
  settings: { tls?: { cert: string; key: string } },
): HttpServer | HttpsServer {
  if (settings.tls !== undefined) {
    try {
      const options = {
        key: fs.readFileSync(settings.tls.key),
        cert: fs.readFileSync(settings.tls.cert),
      };

      logger.debug('[HTTP-Server] HTTPS active', {
        certPath: settings.tls.cert,
        keyPath: settings.tls.key,
      });

      return new HttpsServer(options, app);
    } catch (error) {
      logger.error('[HTTP-Server] Failed to read TLS certificate or key', {
        error: error instanceof Error ? error.message : String(error),
        certPath: settings.tls.cert,
        keyPath: settings.tls.key,
      });

      throw error;
    }
  } else {
    logger.debug('[HTTP-Server] HTTP mode (no TLS)');

    return new HttpServer(app);
  }
}
