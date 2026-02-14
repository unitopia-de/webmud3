import express from 'express';
import sourceMaps from 'source-map-support';
import { v4 as uuidv4 } from 'uuid';

import { MudConfigService } from './core/config/mud-config.service.js';
import { Environment } from './core/environment/environment.js';
import { useBodyParser } from './core/middleware/use-body-parser.js';
import { useConfigEndpoint } from './core/middleware/use-config-endpoint.js';
import { useCors } from './core/middleware/use-cors.js';
import { useInfoEndpoint } from './core/middleware/use-info-endpoint.js';
import { useMudConfigEndpoint } from './core/middleware/use-mud-config-endpoint.js';
import { useSockets } from './core/middleware/use-sockets.js';
import { useStaticFiles } from './core/middleware/use-static-files.js';
import { useRoutes } from './core/routes/routes.js';
import { createHttpServer } from './shared/utils/create-http-server.js';
import { logger } from './shared/utils/logger.js';

sourceMaps.install();

// Global error handlers to prevent silent crashes and improve diagnostics
process.on('uncaughtException', (error: Error) => {
  if (error instanceof AggregateError) {
    logger.error('[Process] Uncaught AggregateError:', {
      message: error.message,
      errors: error.errors.map((subError: Error, i: number) => ({
        index: i,
        message: subError.message,
        code: (subError as NodeJS.ErrnoException).code,
        stack: subError.stack,
      })),
    });
  } else {
    logger.error('[Process] Uncaught Exception:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
  }
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('[Process] Unhandled Promise Rejection:', {
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason,
  });
});

const environment = Environment.getInstance();

const app = express();

const UNIQUE_SERVER_ID = uuidv4();

const httpServer = createHttpServer(app, {});

useCors(app, environment);

useBodyParser(app);

// Todo[myst]: What does this bring to the table?
// useCookieSession(app, secretConfig.mySessionKey);

useStaticFiles(app, 'wwwroot');

const socketManager = useSockets(httpServer, environment);

useConfigEndpoint(app);

// MUD config endpoint (serves MUD list to frontend for Multi-MUD support)
const mudConfigService = MudConfigService.getInstance(
  environment.mudConfigPath,
);

useMudConfigEndpoint(app, mudConfigService);

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
