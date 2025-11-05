import { Socket } from 'socket.io';

import { TelnetClient } from '../../../features/telnet/telnet-client.js';
import { ClientToServerEvents } from './client-to-server-events.js';
import { ServerToClientEvents } from './server-to-client-events.js';

export type MudConnections = {
  [sessionId: string]: {
    telnet: TelnetClient | undefined;
    connectionTimer: NodeJS.Timeout | undefined;
    socket: Socket<ClientToServerEvents, ServerToClientEvents> | undefined;
    bufferedOutput: string[];
  };
};
