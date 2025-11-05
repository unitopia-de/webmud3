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
  private static readonly MAX_BUFFERED_OUTPUT = 500;

  public readonly mudConnections: MudConnections = {};
  private readonly socketToSession = new Map<string, string>();

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
      const sessionId = this.getSessionId(socket);

      this.socketToSession.set(socket.id, sessionId);

      logger.info(`[${socket.id}] [Socket-Manager] Client connected`, {
        socketId: socket.id,
        sessionId,
      });

      const connection = this.ensureConnection(sessionId);
      connection.socket = socket;

      this.handleClientConnection(sessionId, socket);

      if (connection.connectionTimer !== undefined) {
        logger.info(
          `[${socket.id}] [Socket-Manager] Client resetting logout (statue in mud) timer`,
          {
            socketId: socket.id,
            sessionId,
          },
        );

        clearTimeout(connection.connectionTimer);
        connection.connectionTimer = undefined;
      }

      if (connection.telnet !== undefined) {
        logger.info(
          `[${socket.id}] [Socket-Manager] Client already got an established telnet connection. Emitting 'mudConnected'`,
          {
            socketId: socket.id,
            sessionId,
          },
        );

        socket.emit('mudConnected');

        this.emitCurrentOptionStates(connection.telnet, socket);
        this.flushBufferedOutput(sessionId);
      }
    });
  }

  private handleClientConnection(
    sessionId: string,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  ) {
    const connection = this.ensureConnection(sessionId);
    connection.socket = socket;

    socket.on('error', (error: Error) => {
      logger.error(`[${socket.id}] [Socket-Manager] Client error`, {
        socketId: socket.id,
        sessionId,
        error: error,
      });
    });

    socket.on('disconnect', (reason: string) => {
      logger.info(`[${socket.id}] [Socket-Manager] Client disconnected`, {
        reason,
        sessionId,
      });

      this.socketToSession.delete(socket.id);
      connection.socket = undefined;

      logger.info(
        `[${socket.id}] [Socket-Manager] Client starting timer to close telnet connection in ${Environment.getInstance().socketTimeout}ms`,
        {
          socketId: socket.id,
          sessionId,
        },
      );

      connection.connectionTimer = setTimeout(() => {
        this.closeTelnetConnections(sessionId);
      }, Environment.getInstance().socketTimeout);
    });

    socket.on('mudInput', (data: string) => {
      const currentConnection = this.mudConnections[sessionId];
      const telnetClient = currentConnection?.telnet;

      if (telnetClient === undefined || telnetClient.isConnected === false) {
        logger.error(
          `[${socket.id}] [Socket-Manager] Client has no telnet connection established - can not send message to mud!`,
          {
            socketId: socket.id,
            sessionId,
          },
        );

        return;
      }

      const echoState = telnetClient.getOptionState<EchoState>(
        TelnetOptions.TELOPT_ECHO,
      );

      const shouldEchoLocally = echoState?.localEchoEnabled ?? true;

      logger.info(`[${socket.id}] [Socket-Manager] Client input received`, {
        input: shouldEchoLocally ? data : '**OBSCURED**',
        sessionId,
      });

      const linemode = telnetClient.getOptionState<LinemodeState>(
        TelnetOptions.TELOPT_LINEMODE,
      );

      if (linemode !== undefined && linemode.edit === false) {
        telnetClient.sendMessage(data);
      } else {
        telnetClient.sendMessage(`${data}\r`);
      }
    });

    socket.on('mudViewportSize', (columns: number, rows: number) => {
      const currentConnection = this.mudConnections[sessionId];

      currentConnection?.telnet?.updateViewportSize(columns, rows);
    });

    socket.on(
      'mudConnect',
      (initialViewPort: { columns: number; rows: number }) => {
        logger.info(
          `[${socket.id}] [Socket-Manager] Client want to connect to mud`,
          {
            sessionId,
          },
        );

        const existingClient = this.mudConnections[sessionId]?.telnet;

        if (existingClient !== undefined && existingClient.isConnected) {
          logger.info(
            `[${socket.id}] [Socket-Manager] Client is reusing existing telnet connection. Emitting 'mudConnected'`,
            {
              sessionId,
            },
          );

          existingClient.updateViewportSize(
            initialViewPort.columns,
            initialViewPort.rows,
          );

          socket.emit('mudConnected');
          this.emitCurrentOptionStates(existingClient, socket);
          this.flushBufferedOutput(sessionId);

          return;
        }

        logger.info(
          `[${socket.id}] [Socket-Manager] Client had no active telnet connection .. creating new one..`,
          {
            sessionId,
          },
        );

        const telnetClient = new TelnetClient(
          sessionId,
          this.managerOptions.telnetHost,
          this.managerOptions.telnetPort,
          this.managerOptions.useTelnetTls,
          this.managerOptions.clientName,
          {
            initialViewPort,
          },
        );

        const currentConnection = this.ensureConnection(sessionId);

        if (currentConnection.connectionTimer !== undefined) {
          clearTimeout(currentConnection.connectionTimer);
        }

        currentConnection.telnet = telnetClient;
        currentConnection.connectionTimer = undefined;
        currentConnection.socket = socket;

        telnetClient.on('data', (chunk: string | Buffer) => {
          this.handleTelnetData(sessionId, chunk);
        });

        telnetClient.on('close', () => {
          logger.info(
            `[${socket.id}] [Socket-Manager] Client telnet connection closed. Emitting 'mudDisconnected'`,
            {
              sessionId,
            },
          );

          const session = this.mudConnections[sessionId];

          if (session !== undefined) {
            session.telnet = undefined;
          }

          this.emitToActiveSocket(sessionId, 'mudDisconnected');
        });

        telnetClient.on('negotiationChanged', (negotiation) => {
          if (
            negotiation.option === TelnetOptions.TELOPT_TM &&
            negotiation.server === TelnetControlSequences.DO
          ) {
            const delivered = this.emitToActiveSocket(
              sessionId,
              'requestTimingMark',
              () => {
                this.mudConnections[sessionId]?.telnet?.sendTimingMark();
              },
            );

            if (delivered === false) {
              logger.verbose(
                `[${socket.id}] [Socket-Manager] Skipping timing mark request because no active client socket is registered`,
                {
                  sessionId,
                },
              );
            }
          }
        });

        telnetClient.on('negotiationStateChanged', ({ option, state }) => {
          switch (option) {
            case TelnetOptions.TELOPT_ECHO: {
              const echoState = state as EchoState;

              logger.verbose(
                `[${socket.id}] [Socket-Manager] Telnet Option Echo has changed. Emitting 'setEchoMode'`,
                {
                  name: TelnetOptions[TelnetOptions.TELOPT_ECHO],
                  state: state,
                  sessionId,
                },
              );

              this.emitToActiveSocket(
                sessionId,
                'setEchoMode',
                echoState.localEchoEnabled,
              );

              break;
            }

            case TelnetOptions.TELOPT_LINEMODE: {
              const linemodeState = state as LinemodeState;

              logger.verbose(
                `[${socket.id}] [Socket-Manager] Telnet Option Linemode has changed. Emitting 'setLinemode'`,
                {
                  name: TelnetOptions[TelnetOptions.TELOPT_LINEMODE],
                  state: state,
                  sessionId,
                },
              );

              this.emitToActiveSocket(
                sessionId,
                'setLinemode',
                linemodeState,
              );

              break;
            }

            default:
              break;
          }
        });

        logger.info(
          `[${socket.id}] [Socket-Manager] Client .. telnet connection established. Emitting 'mudConnected'`,
          {
            sessionId,
          },
        );

        socket.emit('mudConnected');
        this.emitCurrentOptionStates(telnetClient, socket);
      },
    );

    socket.on('mudDisconnect', () => {
      logger.info(
        `[${socket.id}] [Socket-Manager] Client disconnecting from mud`,
        {
          sessionId,
        },
      );

      this.closeTelnetConnections(sessionId);
    });
  }

  private closeTelnetConnections(sessionId: string) {
    const connection = this.mudConnections[sessionId];
    const telnetClient = connection?.telnet;

    if (telnetClient !== undefined && telnetClient.isConnected) {
      telnetClient.disconnect();
    }

    if (connection?.connectionTimer !== undefined) {
      clearTimeout(connection.connectionTimer);
      connection.connectionTimer = undefined;
    }

    if (connection !== undefined) {
      connection.telnet = undefined;
      connection.bufferedOutput = [];
    }
  }

  private ensureConnection(sessionId: string) {
    if (this.mudConnections[sessionId] === undefined) {
      this.mudConnections[sessionId] = {
        telnet: undefined,
        connectionTimer: undefined,
        socket: undefined,
        bufferedOutput: [],
      };
    }

    return this.mudConnections[sessionId];
  }

  private getSessionId(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  ): string {
    const authSessionId = socket.handshake.auth?.sessionId;

    if (
      typeof authSessionId === 'string' &&
      authSessionId.trim().length > 0
    ) {
      return authSessionId;
    }

    const querySessionId = socket.handshake.query?.sessionId;

    if (
      typeof querySessionId === 'string' &&
      querySessionId.trim().length > 0
    ) {
      return querySessionId;
    }

    if (
      Array.isArray(querySessionId) &&
      querySessionId.length > 0 &&
      typeof querySessionId[0] === 'string' &&
      querySessionId[0].trim().length > 0
    ) {
      return querySessionId[0];
    }

    logger.warn(
      `[${socket.id}] [Socket-Manager] No sessionId provided by client. Falling back to socket.id`,
    );

    return socket.id;
  }

  private handleTelnetData(sessionId: string, data: string | Buffer): void {
    const session = this.mudConnections[sessionId];
    const telnetClient = session?.telnet;

    if (telnetClient === undefined) {
      logger.warn(
        `[Socket-Manager] Received telnet data for unknown session ${sessionId}`,
      );

      return;
    }

    const mudCharset =
      telnetClient.negotiations[TelnetOptions.TELOPT_CHARSET]?.subnegotiation
        ?.clientOption;

    let output: string;

    if (mudCharset === undefined) {
      logger.warn(
        `[Socket-Manager] [Session ${sessionId}] No charset negotiated before receiving data. Defaulting to utf-8`,
      );

      output =
        typeof data === 'string' ? data : data.toString('utf-8');
    } else {
      const charset = mapToServerEncodings(mudCharset);

      if (charset !== null) {
        output =
          typeof data === 'string' ? data : data.toString(charset);
      } else {
        logger.warn(
          `[Socket-Manager] [Session ${sessionId}] Unknown charset ${mudCharset}. Defaulting to utf-8`,
        );

        output =
          typeof data === 'string' ? data : data.toString('utf-8');
      }
    }

    const delivered = this.emitToActiveSocket(sessionId, 'mudOutput', output);

    if (delivered === false) {
      this.bufferTelnetOutput(sessionId, output);
    }
  }

  private bufferTelnetOutput(sessionId: string, output: string): void {
    const session = this.ensureConnection(sessionId);

    session.bufferedOutput.push(output);

    if (session.bufferedOutput.length > SocketManager.MAX_BUFFERED_OUTPUT) {
      session.bufferedOutput.splice(
        0,
        session.bufferedOutput.length - SocketManager.MAX_BUFFERED_OUTPUT,
      );
    }
  }

  private flushBufferedOutput(sessionId: string): void {
    const session = this.mudConnections[sessionId];

    if (session === undefined || session.bufferedOutput.length === 0) {
      return;
    }

    const socket = session.socket;

    if (socket === undefined || socket.disconnected) {
      return;
    }

    for (const output of session.bufferedOutput) {
      socket.emit('mudOutput', output);
    }

    session.bufferedOutput = [];
  }

  private emitToActiveSocket<K extends keyof ServerToClientEvents>(
    sessionId: string,
    event: K,
    ...args: Parameters<ServerToClientEvents[K]>
  ): boolean {
    const session = this.mudConnections[sessionId];
    const socket = session?.socket;

    if (socket !== undefined && socket.disconnected === false) {
      socket.emit(event, ...args);

      return true;
    }

    return false;
  }

  // Todo: Hier wird immer alles doppelt gesendet, auch wenn sich nichts geaendert hat. Besser direkt beim State-Change emittieren
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
