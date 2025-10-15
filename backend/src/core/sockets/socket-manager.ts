import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { Server, Socket } from 'socket.io';

import { TelnetOptions } from '../../features/telnet/models/telnet-options.js';
import { TelnetClient } from '../../features/telnet/telnet-client.js';
import { TelnetControlSequences } from '../../features/telnet/types/telnet-control-sequences.js';
import { EchoState } from '../../features/telnet/utils/handle-echo-option.js';
import { LinemodeState } from '../../features/telnet/utils/handle-linemode-option.js';
import { logger } from '../../shared/utils/logger.js';
import { mapToServerEncodings } from '../../shared/utils/supported-encodings.js';
import { Environment } from '../environment/environment.js';
import { ClientToServerEvents } from './types/client-to-server-events.js';
import { MudConnections } from './types/mud-connections.js';
import { ServerToClientEvents } from './types/server-to-client-events.js';

export class SocketManager extends Server<
  ClientToServerEvents,
  ServerToClientEvents
> {
  public readonly mudConnections: MudConnections = {};

  public constructor(
    server: HttpServer | HttpsServer,
    private readonly managerOptions: {
      telnetHost: string;
      telnetPort: number;
      useTelnetTls: boolean;
      socketRoot: string;
      clientName: string;
    },
  ) {
    super(server, {
      path: managerOptions.socketRoot,
      transports: ['websocket'],
      connectionStateRecovery: {
        maxDisconnectionDuration: Environment.getInstance().socketTimeout,
      },
    });

    this.on('connection', (socket) => {
      logger.info(`[${socket.id}] [Socket-Manager] Client connected`, {
        socketId: socket.id,
      });

      this.handleClientConnection(socket);

      if (this.mudConnections[socket.id] !== undefined) {
        logger.info(`[${socket.id}] [Socket-Manager] Client was reconnecting`, {
          socketId: socket.id,
        });

        const existingTelnet = this.mudConnections[socket.id].telnet;

        if (existingTelnet !== undefined) {
          logger.info(
            `[${socket.id}] [Socket-Manager] Client already got an established telnet connection. Emitting 'mudConnected'`,
            {
              socketId: socket.id,
            },
          );

          socket.emit('mudConnected');

          this.emitCurrentOptionStates(existingTelnet, socket);
        }

        logger.info(
          `[${socket.id}] [Socket-Manager] Client resetting logout (statue in mud) timer`,
          {
            socketId: socket.id,
          },
        );

        if (this.mudConnections[socket.id].connectionTimer !== undefined) {
          clearTimeout(this.mudConnections[socket.id].connectionTimer);

          this.mudConnections[socket.id].connectionTimer = undefined;
        }
      }
    });
  }

  private handleClientConnection(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  ) {
    socket.on('error', (error: Error) => {
      logger.error(`[${socket.id}] [Socket-Manager] Client error`, {
        socketId: socket.id,
        error: error,
      });
    });

    socket.on('disconnect', (reason: string) => {
      logger.info(`[${socket.id}] [Socket-Manager] Client disconnected`, {
        reason,
      });

      logger.info(
        `[${socket.id}] [Socket-Manager] Client starting timer to close telnet connection in ${Environment.getInstance().socketTimeout}ms`,
        {
          socketId: socket.id,
        },
      );

      this.mudConnections[socket.id].connectionTimer = setTimeout(() => {
        this.closeTelnetConnections(socket.id);
      }, Environment.getInstance().socketTimeout);
    });

    socket.on('mudInput', (data: string) => {
      const telnetClient = this.mudConnections[socket.id].telnet;

      if (telnetClient === undefined || telnetClient.isConnected === false) {
        logger.error(
          `[${socket.id}] [Socket-Manager] Client has no telnet connection established - can not send message to mud!`,
          {
            socketId: socket.id,
          },
        );

        return;
      }

      const echoState = telnetClient.getOptionState<EchoState>(
        TelnetOptions.TELOPT_ECHO,
      );

      const shouldEchoLocally = echoState?.localEchoEnabled ?? true;

      logger.info(`[${socket.id}] [Socket-Manager] Client input received`, {
        input: shouldEchoLocally ? data : '**OBSFUSCATED**',
      });

      const linemode = telnetClient.getOptionState<LinemodeState>(
        TelnetOptions.TELOPT_LINEMODE,
      );

      // In linemode with edit disabled, we send the data as-is (user pressed enter already)
      // In all other modes, we append a carriage return to simulate the enter key
      if (linemode !== undefined && linemode.edit === false) {
        telnetClient.sendMessage(data);
      } else {
        telnetClient.sendMessage(`${data}\r`);
      }
    });

    socket.on('mudConnect', () => {
      logger.info(
        `[${socket.id}] [Socket-Manager] Client want to connect to mud`,
      );

      const existingClient = this.mudConnections[socket.id]?.telnet;

      if (existingClient !== undefined && existingClient.isConnected) {
        logger.info(
          `[${socket.id}] [Socket-Manager] Client is reusing existing telnet connection. Emitting 'mudConnected'`,
        );

        socket.emit('mudConnected');

        this.emitCurrentOptionStates(existingClient, socket);

        return;
      }

      logger.info(
        `[${socket.id}] [Socket-Manager] Client had no active telnet connection .. creating new one..`,
      );

      const telnetClient = new TelnetClient(
        socket.id,
        this.managerOptions.telnetHost,
        this.managerOptions.telnetPort,
        this.managerOptions.useTelnetTls,
        this.managerOptions.clientName,
      );

      const previousConnection = this.mudConnections[socket.id];

      if (previousConnection?.connectionTimer !== undefined) {
        clearTimeout(previousConnection.connectionTimer);
      }

      this.mudConnections[socket.id] = {
        telnet: telnetClient,
        connectionTimer: undefined,
      };

      telnetClient.on('data', (data: string | Buffer) => {
        const mudCharset =
          this.mudConnections[socket.id].telnet?.negotiations[
            TelnetOptions.TELOPT_CHARSET
          ]?.subnegotiation?.clientOption;

        if (mudCharset === undefined) {
          logger.warn(
            `[${socket.id}] [Socket-Manager] Client has no charset negotiated before sending data. Default to utf-8`,
          );

          socket.emit('mudOutput', data.toString('utf-8'));

          return;
        }

        const charset = mapToServerEncodings(mudCharset);

        if (charset !== null) {
          socket.emit('mudOutput', data.toString(charset));

          return;
        }

        logger.warn(
          `[Socket-Manager] [Client] ${socket.id} unknown charset ${mudCharset}. Default to utf-8`,
        );

        socket.emit('mudOutput', data.toString('utf-8'));
      });

      telnetClient.on('close', () => {
        logger.info(
          `[${socket.id}] [Socket-Manager] Client telnet connection closed. Emitting 'mudDisconnected'`,
        );

        this.mudConnections[socket.id].telnet = undefined;

        socket.emit('mudDisconnected');
      });

      telnetClient.on('negotiationChanged', (negotiation) => {
        if (
          negotiation.option === TelnetOptions.TELOPT_TM &&
          negotiation.server === TelnetControlSequences.DO
        ) {
          socket.emit('requestTimingMark', () => {
            this.mudConnections[socket.id].telnet?.sendTimingMark();
          });
        }
      });

      telnetClient.on('optionStateChanged', ({ option, state }) => {
        switch (option) {
          case TelnetOptions.TELOPT_ECHO: {
            const echoState = state as EchoState;

            logger.verbose(
              `[${socket.id}] [Socket-Manager] Telnet Option Echo has changed. Emitting 'setEchoMode'`,
              {
                name: TelnetOptions[TelnetOptions.TELOPT_ECHO],
                state: state,
              },
            );

            socket.emit('setEchoMode', echoState.localEchoEnabled);

            break;
          }

          case TelnetOptions.TELOPT_LINEMODE: {
            const linemodeState = state as LinemodeState;

            logger.verbose(
              `[${socket.id}] [Socket-Manager] Telnet Option Linemode has changed. Emitting 'setLinemode'`,
              {
                name: TelnetOptions[TelnetOptions.TELOPT_LINEMODE],
                state: state,
              },
            );

            socket.emit('setLinemode', linemodeState);

            break;
          }

          default:
            break;
        }
      });

      logger.info(
        `[${socket.id}] [Socket-Manager] Client .. telnet connection established. Emitting 'mudConnected'`,
      );

      socket.emit('mudConnected');

      this.emitCurrentOptionStates(telnetClient, socket);
    });

    socket.on('mudDisconnect', () => {
      logger.info(
        `[${socket.id}] [Socket-Manager] Client disconnecting from mud`,
      );

      this.closeTelnetConnections(socket.id);
    });
  }

  private closeTelnetConnections(socketId: string) {
    const telnetClient = this.mudConnections[socketId]?.telnet;

    if (telnetClient !== undefined && telnetClient.isConnected) {
      telnetClient.disconnect();

      if (this.mudConnections[socketId].connectionTimer !== undefined) {
        clearTimeout(this.mudConnections[socketId].connectionTimer);

        this.mudConnections[socketId].connectionTimer = undefined;
      }

      this.mudConnections[socketId].telnet = undefined;
    }
  }

  // Todo: Hier wird immer alles doppelt gesendet, auch wenn sich nichts geändert hat. Besser direkt beim State-Change emittieren
  private emitCurrentOptionStates(
    telnetClient: TelnetClient,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  ): void {
    const echoState = telnetClient.getOptionState<EchoState>(
      TelnetOptions.TELOPT_ECHO,
    );

    if (echoState !== undefined) {
      socket.emit('setEchoMode', echoState.localEchoEnabled);
    }

    const linemodeState = telnetClient.getOptionState<LinemodeState>(
      TelnetOptions.TELOPT_LINEMODE,
    );

    if (linemodeState !== undefined) {
      socket.emit('setLinemode', linemodeState);
    }
  }
}
