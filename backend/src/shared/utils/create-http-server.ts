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
    const options = {
      key: fs.readFileSync(settings.tls.key),
      cert: fs.readFileSync(settings.tls.cert),
    };

    logger.debug('SRV://5000 : INIT: https active');

    return new HttpsServer(options, app);
  } else {
    return new HttpServer(app);
  }
}
