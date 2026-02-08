import { Express, Request, Response } from 'express';

import { logger } from '../../shared/utils/logger.js';
import { Environment } from '../environment/environment.js';

export const useConfigEndpoint = (app: Express) => {
  app.get('/api/config', (req: Request, res: Response) => {
    logger.info(`[Routes] requested /api/config`);

    const environment = Environment.getInstance();

    res.json({
      socketNamespace: environment.socketRoot,
    });
  });
};
