import cors, { CorsOptions } from 'cors';
import { Express } from 'express';

import { logger } from '../../shared/utils/logger.js';
import { Environment } from '../environment/environment.js';

export const useCors = (app: Express, environment: Environment) => {
  const allowList = environment.corsAllowList;

  if (environment.environment === 'development') {
    logger.info('[Middleware] [CORS] Enabling permissive CORS for development');

    app.use(
      cors({
        origin: true,
        credentials: true,
      }),
    );

    return;
  }

  if (allowList.length === 0) {
    logger.info('[Middleware] [CORS] No CORS configuration applied');

    return;
  }

  logger.info('[Middleware] [CORS] Enabling restricted CORS', { allowList });

  const corsOptions: CorsOptions = {
    origin(origin, callback) {
      if (!origin || allowList.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  };

  app.use(cors(corsOptions));
};
