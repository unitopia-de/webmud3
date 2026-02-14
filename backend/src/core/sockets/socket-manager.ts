import type {
  ClientToServerEvents,
  GmcpSupport,
  LinemodeState,
  ServerToClientEvents,
} from '@webmud3/shared';
import { randomUUID } from 'crypto';
import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { Server, Socket } from 'socket.io';

import { TelnetOptions } from '../../features/telnet/models/telnet-options.js';
import { TelnetClient } from '../../features/telnet/telnet-client.js';
import { TelnetControlSequences } from '../../features/telnet/types/telnet-control-sequences.js';
import { EchoState } from '../../features/telnet/utils/handle-echo-option.js';
import { logger } from '../../shared/utils/logger.js';
import { mapToServerEncodings } from '../../shared/utils/supported-encodings.js';
import { MudConfigService } from '../config/mud-config.service.js';
import { Environment } from '../environment/environment.js';
import type { MudConnections } from './types/mud-connections.js';
import { OutputLineBuffer } from './types/mud-connections.js';

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
    private readonly mudConfigService?: MudConfigService,
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
        recovered: socket.recovered,
      });

      const handshakeSessionToken = this.getSessionTokenFromSocket(socket);

      if (handshakeSessionToken) {
        const existingConnection = this.mudConnections[handshakeSessionToken];

        if (existingConnection !== undefined) {
          existingConnection.socketId = socket.id;

          if (existingConnection.connectionTimer !== undefined) {
            clearTimeout(existingConnection.connectionTimer);

            existingConnection.connectionTimer = undefined;
          }

          const existingTelnet = existingConnection.telnet;

          if (existingTelnet !== undefined && existingTelnet.isConnected) {
            logger.info(
              `[${socket.id}] [Socket-Manager] Client reattached via handshake token. Emitting 'mudConnected'`,
              {
                sessionToken: handshakeSessionToken,
              },
            );

            socket.emit('mudConnected', false, handshakeSessionToken); // isNewConnection = false

            this.emitCurrentOptionStates(existingTelnet, socket);

            const bufferedEntries =
              existingConnection.outputLineBuffer.getEntries();

            if (bufferedEntries.length > 0) {
              logger.info(
                `[${socket.id}] [Socket-Manager] Sending ${bufferedEntries.length} buffered entries to reconnected client`,
                {
                  socketId: socket.id,
                },
              );

              // Send buffered entries as batch with sequence numbers
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (socket as unknown as any).emit(
                'mudOutputBatch',
                bufferedEntries,
              );
            }
          }
        }
      }

      this.handleClientConnection(socket);
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

      const existing = this.getConnectionBySocketId(socket.id);

      if (existing === undefined) {
        return;
      }

      existing.connection.connectionTimer = setTimeout(() => {
        this.closeTelnetConnections(existing.sessionToken);
      }, Environment.getInstance().socketTimeout);
    });

    socket.on('mudInput', (data: string) => {
      const existing = this.getConnectionBySocketId(socket.id);

      if (existing === undefined) {
        logger.error(
          `[${socket.id}] [Socket-Manager] Client has no session - can not send message to mud!`,
          {
            socketId: socket.id,
          },
        );

        return;
      }

      const telnetClient = existing.connection.telnet;

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

    socket.on('mudViewportSize', (columns: number, rows: number) => {
      const existing = this.getConnectionBySocketId(socket.id);

      if (existing === undefined) {
        return;
      }

      if (existing.connection.telnet !== undefined) {
        existing.connection.telnet.updateViewportSize(columns, rows);
      }
    });

    socket.on(
      'mudConnect',
      (
        initialViewPort: { columns: number; rows: number },
        sessionToken: string,
        mudId?: string,
      ) => {
        const resolvedSessionToken =
          sessionToken ||
          this.getSessionTokenFromSocket(socket) ||
          randomUUID();

        logger.info(
          `[${socket.id}] [Socket-Manager] Client want to connect to mud`,
          {
            sessionToken: resolvedSessionToken,
            mudId: mudId ?? '(default)',
          },
        );

        const existingConnection = this.mudConnections[resolvedSessionToken];

        if (existingConnection !== undefined) {
          existingConnection.socketId = socket.id;

          if (existingConnection.connectionTimer !== undefined) {
            clearTimeout(existingConnection.connectionTimer);

            existingConnection.connectionTimer = undefined;
          }

          const existingClient = existingConnection.telnet;

          if (existingClient !== undefined && existingClient.isConnected) {
            logger.info(
              `[${socket.id}] [Socket-Manager] Client is reusing existing telnet connection. Emitting 'mudConnected'`,
              {
                sessionToken: resolvedSessionToken,
              },
            );

            existingClient.updateViewportSize(
              initialViewPort.columns,
              initialViewPort.rows,
            );

            socket.emit('mudConnected', false, resolvedSessionToken); // isNewConnection = false

            this.emitCurrentOptionStates(existingClient, socket);

            const bufferedEntries =
              existingConnection.outputLineBuffer.getEntries();

            if (bufferedEntries.length > 0) {
              logger.info(
                `[${socket.id}] [Socket-Manager] Sending ${bufferedEntries.length} buffered entries to reconnected client`,
                {
                  socketId: socket.id,
                },
              );

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (socket as unknown as any).emit(
                'mudOutputBatch',
                bufferedEntries,
              );
            }

            return;
          }
        }

        // Resolve connection parameters: MudConfigService (by mudId) or fallback to env vars
        const resolvedConnection = this.resolveConnectionParams(mudId);

        logger.info(
          `[${socket.id}] [Socket-Manager] Client had no active telnet connection .. creating new one..`,
          {
            sessionToken: resolvedSessionToken,
            host: resolvedConnection.host,
            port: resolvedConnection.port,
            mudId: mudId ?? '(default)',
          },
        );

        // Create output buffer BEFORE telnet client so all data is captured from the start
        const outputBuffer =
          existingConnection?.outputLineBuffer ?? new OutputLineBuffer();

        const telnetClient = new TelnetClient(
          socket.id,
          resolvedConnection.host,
          resolvedConnection.port,
          resolvedConnection.ssl,
          this.managerOptions.clientName,
          {
            initialViewPort,
          },
        );

        this.mudConnections[resolvedSessionToken] = {
          telnet: telnetClient,
          connectionTimer: undefined,
          outputLineBuffer: outputBuffer,
          socketId: socket.id,
        };

        // Register buffer listener IMMEDIATELY to capture all telnet data
        // This ensures buffering happens even when socket is disconnected
        telnetClient.on('data', (data: string | Buffer) => {
          const mudCharset =
            this.mudConnections[resolvedSessionToken]?.telnet?.negotiations[
              TelnetOptions.TELOPT_CHARSET
            ]?.subnegotiation?.clientOption;

          let outputString: string;

          if (mudCharset === undefined) {
            logger.warn(
              `[${socket.id}] [Socket-Manager] Client has no charset negotiated before sending data. Default to utf-8`,
            );

            outputString = data.toString('utf-8');
          } else {
            const charset = mapToServerEncodings(mudCharset);

            if (charset !== null) {
              outputString = data.toString(charset);
            } else {
              logger.warn(
                `[Socket-Manager] [Client] ${socket.id} unknown charset ${mudCharset}. Default to utf-8`,
              );

              outputString = data.toString('utf-8');
            }
          }

          // ALWAYS buffer the output, regardless of socket connection status
          const seq = outputBuffer.addData(outputString);

          // Emit to socket only if connected
          const currentSocket = this.getSocketById(
            this.mudConnections[resolvedSessionToken]?.socketId,
          );

          if (currentSocket !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (currentSocket as unknown as any).emit(
              'mudOutput',
              outputString,
              seq,
            );
          }
        });

        telnetClient.on('close', () => {
          logger.info(
            `[${socket.id}] [Socket-Manager] Client telnet connection closed. Emitting 'mudDisconnected'`,
          );

          const connection = this.mudConnections[resolvedSessionToken];

          if (connection !== undefined) {
            connection.telnet = undefined;

            const targetSocket = this.getSocketById(connection.socketId);

            if (targetSocket !== undefined) {
              targetSocket.emit('mudDisconnected');
            }
          }
        });

        telnetClient.on(
          'gmcpIncoming',
          (module: string, message: string, data: unknown) => {
            const connection = this.mudConnections[resolvedSessionToken];
            const targetSocket = connection
              ? this.getSocketById(connection.socketId)
              : undefined;

            if (targetSocket !== undefined) {
              logger.verbose(
                `[${socket.id}] [Socket-Manager] Forwarding GMCP incoming: ${module}.${message}`,
              );

              targetSocket.emit('mudGmcpIncoming', module, message, data);
            }
          },
        );

        telnetClient.on('gmcpStart', () => {
          const connection = this.mudConnections[resolvedSessionToken];
          const targetSocket = connection
            ? this.getSocketById(connection.socketId)
            : undefined;

          if (targetSocket !== undefined) {
            // Resolve GMCP support from MUD family config (if available)
            const gmcpSupport: GmcpSupport =
              resolvedConnection.gmcpSupport ?? {};

            logger.info(
              `[${socket.id}] [Socket-Manager] GMCP started. Emitting 'mudGmcpStart'.`,
              {
                moduleCount: Object.keys(gmcpSupport).length,
              },
            );

            targetSocket.emit('mudGmcpStart', gmcpSupport);
          }
        });

        telnetClient.on('negotiationChanged', (negotiation) => {
          if (
            negotiation.option === TelnetOptions.TELOPT_TM &&
            negotiation.server === TelnetControlSequences.DO
          ) {
            const connection = this.mudConnections[resolvedSessionToken];

            const targetSocket = connection
              ? this.getSocketById(connection.socketId)
              : undefined;

            if (connection !== undefined && targetSocket !== undefined) {
              targetSocket.emit('requestTimingMark', () => {
                connection.telnet?.sendTimingMark();
              });
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

        socket.emit('mudConnected', true, resolvedSessionToken); // isNewConnection = true

        this.emitCurrentOptionStates(telnetClient, socket);
      },
    );

    socket.on(
      'mudGmcpOutgoing',
      (module: string, message: string, data: unknown) => {
        const existing = this.getConnectionBySocketId(socket.id);

        if (existing === undefined) {
          logger.error(
            `[${socket.id}] [Socket-Manager] Client has no session - cannot send GMCP!`,
          );

          return;
        }

        const telnetClient = existing.connection.telnet;

        if (telnetClient === undefined || !telnetClient.isConnected) {
          logger.error(
            `[${socket.id}] [Socket-Manager] Client has no telnet connection - cannot send GMCP!`,
          );

          return;
        }

        logger.verbose(
          `[${socket.id}] [Socket-Manager] Forwarding GMCP outgoing: ${module}.${message}`,
        );

        telnetClient.sendGmcp(module, message, data);
      },
    );

    socket.on('mudDisconnect', () => {
      logger.info(
        `[${socket.id}] [Socket-Manager] Client disconnecting from mud`,
      );

      const existing = this.getConnectionBySocketId(socket.id);

      if (existing !== undefined) {
        this.closeTelnetConnections(existing.sessionToken);
      }
    });
  }

  private closeTelnetConnections(sessionToken: string) {
    const telnetClient = this.mudConnections[sessionToken]?.telnet;

    if (telnetClient !== undefined && telnetClient.isConnected) {
      telnetClient.disconnect();

      if (this.mudConnections[sessionToken].connectionTimer !== undefined) {
        clearTimeout(this.mudConnections[sessionToken].connectionTimer);

        this.mudConnections[sessionToken].connectionTimer = undefined;
      }

      this.mudConnections[sessionToken].telnet = undefined;
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

  /**
   * Buffers output in complete lines (separated by \n) and emits to client.
   * Only complete lines are added to the buffer.
   *
   * @deprecated This method is no longer needed. Output buffering happens directly
   * in the telnet 'data' event listener registered in mudConnect handler.
   */

  private getConnectionBySocketId(
    socketId: string,
  ): { sessionToken: string; connection: MudConnections[string] } | undefined {
    for (const [sessionToken, connection] of Object.entries(
      this.mudConnections,
    )) {
      if (connection.socketId === socketId) {
        return { sessionToken, connection };
      }
    }

    return undefined;
  }

  private getSocketById(socketId: string | undefined) {
    if (!socketId) {
      return undefined;
    }

    return this.sockets.sockets.get(socketId);
  }

  private getSessionTokenFromSocket(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  ): string | undefined {
    const authToken = socket.handshake.auth?.sessionToken;

    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    return undefined;
  }

  /**
   * Resolves the telnet connection parameters for a given MUD ID.
   *
   * Priority:
   * 1. If mudId is given AND MudConfigService has config → use config values
   * 2. Otherwise → fall back to managerOptions (from TELNET_HOST/PORT env vars)
   */
  private resolveConnectionParams(mudId?: string): {
    host: string;
    port: number;
    ssl: boolean;
    mudfamily?: string;
    gmcpSupport?: GmcpSupport;
  } {
    if (mudId !== undefined && this.mudConfigService?.isAvailable) {
      const resolved = this.mudConfigService.resolveConnection(mudId);

      if (resolved !== undefined) {
        const gmcpSupport = this.mudConfigService.getGmcpSupport(mudId);

        logger.info(
          `[Socket-Manager] Resolved MUD "${mudId}" → ${resolved.host}:${resolved.port} (family: ${resolved.mudfamily})`,
        );

        return {
          host: resolved.host,
          port: resolved.port,
          ssl: resolved.ssl,
          mudfamily: resolved.mudfamily,
          gmcpSupport,
        };
      }

      logger.warn(
        `[Socket-Manager] MUD "${mudId}" not found in config. Falling back to env defaults.`,
      );
    }

    // Fallback: use the default TELNET_HOST/PORT from environment
    return {
      host: this.managerOptions.telnetHost,
      port: this.managerOptions.telnetPort,
      ssl: this.managerOptions.useTelnetTls,
    };
  }
}
