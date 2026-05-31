import express from 'express';
import sourceMaps from 'source-map-support';
import { v4 as uuidv4 } from 'uuid';

import { Environment } from './core/environment/environment.js';
import { useBodyParser } from './core/middleware/use-body-parser.js';
import { useConfigEndpoint } from './core/middleware/use-config-endpoint.js';
import { useCors } from './core/middleware/use-cors.js';
import { useInfoEndpoint } from './core/middleware/use-info-endpoint.js';
import { useManifestEndpoint } from './core/middleware/use-manifest-endpoint.js';
import { useSockets } from './core/middleware/use-sockets.js';
import { useStaticFiles } from './core/middleware/use-static-files.js';
import { useRoutes } from './core/routes/routes.js';
import { createHttpServer } from './shared/utils/create-http-server.js';
import { logger } from './shared/utils/logger.js';

sourceMaps.install();

const environment = Environment.getInstance();

const app = express();

const UNIQUE_SERVER_ID = uuidv4();

const httpServer = createHttpServer(app, {});

useCors(app, environment);

useBodyParser(app);

// Todo[myst]: What does this bring to the table?
// useCookieSession(app, secretConfig.mySessionKey);

// Distribution-aware PWA manifest. MUST come before useStaticFiles so it
// wins over the static handler for /manifest.webmanifest.
useManifestEndpoint(app);

useStaticFiles(app, 'wwwroot');

const socketManager = useSockets(httpServer, environment, UNIQUE_SERVER_ID);

useConfigEndpoint(app);

// Enable Debug Info Endpoints in Development Mode
if (environment.environment === 'development') {
  useInfoEndpoint(app, socketManager);
}

useRoutes(app);

httpServer.listen(environment.port, environment.host, 10000, () => {
  logger.info(`[Main] Server started on port ${environment.port}`, {
    UNIQUE_SERVER_ID,
  });
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
// On SIGTERM (docker stop, k8s) or SIGINT (Ctrl+C) we notify all connected
// clients (so they can reload), close every active telnet session, then close
// the http and socket.io servers before exiting.

const SHUTDOWN_TIMEOUT_MS = 10_000;
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`[Main] Received ${signal}. Initiating graceful shutdown.`);

  // Hard exit if shutdown takes too long (e.g. hung connection).
  const forceExit = setTimeout(() => {
    logger.error(
      `[Main] Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms. Forcing exit.`,
    );
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await socketManager.shutdownAll();

    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });

    logger.info('[Main] Shutdown complete.');
    process.exit(0);
  } catch (error) {
    logger.error('[Main] Error during graceful shutdown', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
