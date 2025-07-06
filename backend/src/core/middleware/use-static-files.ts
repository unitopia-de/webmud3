import express, { Express } from 'express';
import path from 'path';

import { logger } from '../../shared/utils/logger.js';
import { Environment } from '../environment/environment.js';

export const useStaticFiles = (app: Express, folder: string) => {
  const assetPath = path.join(Environment.getInstance().projectRoot, folder);

  logger.info(
    `[Middleware] [Static-Files] Serving static files from ${assetPath}`,
  );

  app.use(express.static(assetPath));
};
