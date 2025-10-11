import express from 'express';
import sourceMaps from 'source-map-support';
import { v4 as uuidv4 } from 'uuid';

import { Environment } from './core/environment/environment.js';
import { useBodyParser } from './core/middleware/use-body-parser.js';
import { useConfigEndpoint } from './core/middleware/use-config-endpoint.js';
import { useCors } from './core/middleware/use-cors.js';
import { useInfoEndpoint } from './core/middleware/use-info-endpoint.js';
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

useStaticFiles(app, 'wwwroot');

const socketManager = useSockets(httpServer, environment);

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
