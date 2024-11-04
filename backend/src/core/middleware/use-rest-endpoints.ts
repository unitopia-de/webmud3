import { Express, Request, Response } from 'express';

import { TelnetOptions } from '../../features/telnet/models/telnet-options.js';
import { TelnetControlSequences } from '../../features/telnet/types/telnet-control-sequences.js';
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
          ([negotiationKey, negotiations]) => {
            const key = Number(negotiationKey);

            return {
              code: TelnetOptions[key],
              ...{
                server: negotiations?.server
                  ? TelnetControlSequences[negotiations?.server]
                  : {},
              },
              ...{
                client: negotiations?.client
                  ? TelnetControlSequences[negotiations?.client]
                  : {},
              },
              ...negotiations?.subnegotiation,
            };
          },
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
