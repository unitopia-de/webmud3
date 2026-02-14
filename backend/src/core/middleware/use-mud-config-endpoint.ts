import { Express, Request, Response } from 'express';

import { MudConfigService } from '../config/mud-config.service.js';
import { logger } from '../../shared/utils/logger.js';

/**
 * Registers the GET /api/mud-config endpoint.
 *
 * Returns the available MUD list and routes to the frontend.
 * If no mud_config.json is loaded, returns an empty response
 * (the frontend then knows it is in single-MUD mode).
 */
export const useMudConfigEndpoint = (
  app: Express,
  mudConfigService: MudConfigService,
) => {
  app.get('/api/mud-config', (req: Request, res: Response) => {
    logger.info(`[Routes] requested /api/mud-config`);

    if (!mudConfigService.isAvailable) {
      res.json({
        available: false,
        muds: {},
        routes: {},
      });

      return;
    }

    res.json({
      available: true,
      muds: mudConfigService.getMudList(),
      routes: mudConfigService.getRoutes(),
    });
  });
};
