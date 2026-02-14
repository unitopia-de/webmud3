import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';

import { MudConfigService } from '../config/mud-config.service.js';
import { Environment } from '../environment/environment.js';
import { SocketManager } from '../sockets/socket-manager.js';

export const useSockets = (
  httpServer: HttpServer | HttpsServer,
  environment: Environment,
) => {
  const mudConfigService = MudConfigService.getInstance(
    environment.mudConfigPath,
  );

  return new SocketManager(
    httpServer,
    {
      telnetHost: environment.telnetHost,
      telnetPort: environment.telnetPort,
      useTelnetTls: environment.telnetTLS,
      socketRoot: environment.socketRoot,
      clientName: environment.name,
    },
    mudConfigService,
  );
};
