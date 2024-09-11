import { Express, Request, Response } from 'express';

import { logger } from '../../shared/utils/logger.js';
import { SocketManager } from '../sockets/socket-manager.js';

export const useRestEndpoints = (
  app: Express,
  socketManager: SocketManager,
) => {
  app.use('/api/info', (req: Request, res: Response) => {
    logger.info(`[Middleware] [Rest] requested /api/info`);

    const connections = Object.entries(socketManager.mudConnections).flatMap(
      ([connectionKey, con]) => {
        const negotiations = Object.entries(con.telnet?.negotiations || {}).map(
          ([negotiationKey, negotiations]) => ({
            code: negotiationKey,
            ...negotiations,
          }),
        );

        return {
          connection: connectionKey,
          telnet: {
            connected:
              con.telnet?.isConnected === undefined
                ? 'no instance'
                : con.telnet.isConnected,
            negotiations,
          },
        };
      },
    );

    res.send(connections);
  });
};
