import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';

import { Environment } from '../environment/environment.js';
import { SocketManager } from '../sockets/socket-manager.js';

export const useSockets = (
  httpServer: HttpServer | HttpsServer,
  environment: Environment,
) => {
  new SocketManager(httpServer, {
    telnetHost: environment.telnetHost,
    telnetPort: environment.telnetPort,
    useTls: environment.telnetTLS,
    socketRoot: environment.socketRoot,
  });
};
