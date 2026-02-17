import EventEmitter from 'events';
import net from 'net';
import { TelnetSocket } from 'telnet-stream';
import tls from 'tls';

import { logger } from '../../shared/utils/logger.js';
import { TelnetOptions } from './models/telnet-options.js';
import { TelnetStatusSubnogiation } from './models/telnet-status-subnogiation.js';
import { TelnetControlSequences } from './types/telnet-control-sequences.js';
import { TelnetNegotiations } from './types/telnet-negotiations.js';
import { TelnetOptionHandler } from './types/telnet-option-handler.js';
import { handleCharsetOption } from './utils/handle-charset-option.js';
import { handleEchoOption } from './utils/handle-echo-option.js';
import { handleEorOption } from './utils/handle-eor-option.js';
import {
  GmcpIncomingMessage,
  GmcpOptionHandler,
  handleGmcpOption,
} from './utils/handle-gmcp-option.js';
import { handleLinemodeOption } from './utils/handle-linemode-option.js';
import { handleMSSPOption } from './utils/handle-mssp-option.js';
import {
  handleNawsOption,
  NawsOptionHandler,
} from './utils/handle-naws-option.js';
import { handleSGAOption } from './utils/handle-sga-option.js';
import { handleStatusOption } from './utils/handle-status-option.js';
import { handleTTypeOption } from './utils/handle-ttype-option.js';
import { TelnetSocketWrapper } from './utils/telnet-socket-wrapper.js';

type TelnetClientEvents = {
  data: [string | Buffer];
  close: [boolean];
  negotiationChanged: [
    {
      option: TelnetOptions;
      server?: TelnetControlSequences;
      client?: TelnetControlSequences;
    },
  ];
  negotiationStateChanged: [
    {
      option: TelnetOptions;
      state: unknown;
    },
  ];
  /**
   * Emitted when a GMCP message is received from the MUD server.
   * The message has been parsed into module, message name, and JSON data.
   */
  gmcpIncoming: [module: string, message: string, data: unknown];
  /**
   * Emitted when GMCP negotiation succeeds and the protocol becomes active.
   */
  gmcpStart: [];
};

/**
 * Represents a client for handling telnet communication tailored for MUD games.
 */
export class TelnetClient extends EventEmitter<TelnetClientEvents> {
  private _negotiations: TelnetNegotiations = {};

  private readonly telnetSocket: TelnetSocket;

  // Is used to buffer incoming data until the EOR is received, if EOR is enabled
  private eorBuffer: Buffer | null = null;

  private connected: boolean = false;

  private readonly optionsHandler: Map<TelnetOptions, TelnetOptionHandler>;

  private readonly optionStateMap = new Map<TelnetOptions, unknown>();

  private optionStateListeners: Array<{
    handler: TelnetOptionHandler;
    listener: (state: unknown) => void;
  }> = [];

  public get isConnected(): boolean {
    return this.connected;
  }

  public get negotiations(): TelnetNegotiations {
    return { ...this._negotiations };
  }

  /**
   * Constructs a new instance of the TelnetClient class.
   *
   * @param {string} socketId - The unique identifier for the socket connection to the client.
   * @param {string} telnetHost - The hostname or IP address of the Telnet server.
   * @param {number} telnetPort - The port number of the Telnet server.
   * @param {boolean} useTls - Indicates whether to use TLS encryption for the connection.
   * @param {string} clientName - The name of the client, used for TTYPE negotiation.
   */
  constructor(
    private readonly socketId: string,
    telnetHost: string,
    telnetPort: number,
    useTls: boolean,
    clientName: string,
    extraOptions?: {
      initialViewPort: { columns: number; rows: number };
      keepAliveDelayMs?: number;
    },
  ) {
    super();

    const telnetConnection = createTelnetConnection(
      useTls,
      telnetHost,
      telnetPort,
    );

    if (extraOptions?.keepAliveDelayMs !== undefined) {
      // Enable TCP keepalive to reduce idle disconnects on intermediaries.
      telnetConnection.setKeepAlive(true, extraOptions.keepAliveDelayMs);
    }

    // CRITICAL: Register error handler on the raw TCP/TLS socket IMMEDIATELY
    // to prevent uncaught exceptions. Without this, connection failures
    // (especially AggregateError from Node.js happy-eyeballs DNS resolution)
    // crash the entire process.
    //
    // NOTE: telnet-stream's TelnetSocket.on() proxies non-telnet events
    // (like 'error', 'close', 'connect') directly to the raw socket.
    // So we ONLY register the error handler HERE on the raw socket.
    // Do NOT add another error handler on this.telnetSocket - it would
    // be a duplicate on the same underlying socket.
    //
    // We also do NOT manually emit 'close' here. The raw socket will
    // emit 'close' naturally after 'error', and telnet-stream proxies
    // that to telnetSocket, which triggers our handleClose() method.
    telnetConnection.on('error', (error: Error) => {
      const details = formatConnectionError(error);

      logger.error(
        `[${this.socketId}] [Telnet-Client] Socket error (${telnetHost}:${telnetPort}, tls=${useTls}): ${error.message}`,
        details,
      );
    });

    if (useTls) {
      logger.info(
        `[${this.socketId}] [Telnet-Client] created https connection for telnet`,
        {
          host: telnetHost,
          port: telnetPort,
          rejectUnauthorized: true,
        },
      );
    } else {
      logger.info(
        `[${this.socketId}] [Telnet-Client] created http connection for telnet`,
        {
          host: telnetHost,
          port: telnetPort,
        },
      );
    }

    this.telnetSocket = new TelnetSocketWrapper(
      this.socketId,
      telnetConnection,
      {
        // Todo[myst]: Is this the right buffer size? Is it needed anyway?
        bufferSize: 65536,
      },
    );

    this.optionsHandler = new Map([
      [TelnetOptions.TELOPT_CHARSET, handleCharsetOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_ECHO, handleEchoOption(this.telnetSocket)],
      [
        TelnetOptions.TELOPT_NAWS,
        handleNawsOption(this.telnetSocket, extraOptions?.initialViewPort),
      ],
      [TelnetOptions.TELOPT_SGA, handleSGAOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_LINEMODE, handleLinemodeOption(this.telnetSocket)],
      [
        TelnetOptions.TELOPT_TTYPE,
        handleTTypeOption(this.telnetSocket, clientName),
      ],
      [TelnetOptions.TELOPT_STATUS, handleStatusOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_MSSP, handleMSSPOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_EOR, handleEorOption(this.telnetSocket)],
      [
        TelnetOptions.TELOPT_GMCP,
        handleGmcpOption(
          this.telnetSocket,
          this.socketId,
          (msg: GmcpIncomingMessage) => {
            this.emit('gmcpIncoming', msg.module, msg.message, msg.data);
          },
        ),
      ],
    ]);

    this.setupOptionStateTracking();

    this.telnetSocket.on('connect', () => this.handleConnect());

    this.telnetSocket.on('close', (hadErrors) => this.handleClose(hadErrors));

    this.telnetSocket.on('do', (option) => this.handleDo(option));

    this.telnetSocket.on('dont', (option) => this.handleDont(option));

    this.telnetSocket.on('will', (option) => this.handleWill(option));

    this.telnetSocket.on('wont', (option) => this.handleWont(option));

    this.telnetSocket.on('sub', (option, chunkData) =>
      this.handleSub(option, chunkData),
    );

    this.telnetSocket.on('data', (chunkData: string | Buffer) => {
      // If EOR mode is enabled, we buffer incoming data until the EOR is received
      // this "groups" responses correctly for the client
      // else we emit the data directly to the client
      if (this.eorBuffer !== null) {
        this.eorBuffer = Buffer.concat([
          this.eorBuffer,
          Buffer.from(chunkData),
        ]);
      } else {
        this.emit('data', chunkData);
      }
    });

    this.telnetSocket.on('command', (command) => {
      if (
        command === TelnetOptions.TELOPT_EOR ||
        command == TelnetOptions.EOR
      ) {
        if (this.eorBuffer !== null) {
          this.emit('data', this.eorBuffer);

          this.eorBuffer = Buffer.alloc(0);
        }
      }
    });

    this.on('negotiationChanged', (negotiation) => {
      // Request initial status data after negotiation - we use TTYPE since this is subnegotiated the last and only once
      // Todo[myst]: Find a better way to do this but its not that easy, since everything is async
      if (negotiation.option === TelnetOptions.TELOPT_TTYPE) {
        this.requestStatus();
      }

      // Emit gmcpStart when GMCP is successfully negotiated (server WILL, we DO)
      if (negotiation.option === TelnetOptions.TELOPT_GMCP) {
        const clientOption =
          this._negotiations[TelnetOptions.TELOPT_GMCP]?.client;

        const serverOption =
          this._negotiations[TelnetOptions.TELOPT_GMCP]?.server;

        if (
          serverOption === TelnetControlSequences.WILL &&
          clientOption === TelnetControlSequences.DO
        ) {
          logger.info(
            `[${this.socketId}] [Telnet-Client] GMCP negotiation successful. Emitting 'gmcpStart'.`,
          );

          this.emit('gmcpStart');
        }
      }

      if (negotiation.option === TelnetOptions.TELOPT_EOR) {
        const clientOption =
          this.negotiations[TelnetOptions.TELOPT_EOR]?.client;

        const serverOption =
          this.negotiations[TelnetOptions.TELOPT_EOR]?.server;

        // Initialize EOR buffer once after successful negotiation
        // or disable the eor buffer if negotiation fails
        if (
          serverOption === TelnetControlSequences.WILL &&
          clientOption === TelnetControlSequences.DO &&
          this.eorBuffer === null
        ) {
          this.eorBuffer = Buffer.alloc(0);
        } else {
          this.eorBuffer = null;
        }
      }
    });
  }

  public sendMessage(data: string): void {
    this.telnetSocket.write(data);
  }

  /**
   * Sends a GMCP message to the MUD server.
   * Only works when GMCP has been successfully negotiated.
   *
   * @param module - Top-level module name (e.g. "Core")
   * @param message - Message name (e.g. "Supports.Set")
   * @param data - Payload to JSON-encode
   */
  public sendGmcp(module: string, message: string, data: unknown): void {
    const handler = this.optionsHandler.get(TelnetOptions.TELOPT_GMCP) as
      | GmcpOptionHandler
      | undefined;

    if (handler === undefined) {
      logger.warn(
        `[${this.socketId}] [Telnet-Client] GMCP handler not registered`,
      );

      return;
    }

    handler.sendGmcp(module, message, data);
  }

  public updateViewportSize(columns: number, rows: number): void {
    const handler = this.optionsHandler.get(TelnetOptions.TELOPT_NAWS) as
      | NawsOptionHandler
      | undefined;

    const subnegotiation = handler?.updateViewportSize(columns, rows);

    if (subnegotiation === undefined || subnegotiation === null) {
      return;
    }

    this.updateNegotiations(TelnetOptions.TELOPT_NAWS, {
      clientChunk: subnegotiation.clientChunk,
      clientOption: subnegotiation.clientOption,
    });
  }

  public getOptionState<TState = unknown>(
    option: TelnetOptions,
  ): TState | undefined {
    return this.optionStateMap.get(option) as TState | undefined;
  }

  public requestStatus(): void {
    const buffer = Buffer.from([TelnetStatusSubnogiation.STATUS_SEND]);

    if (!this.connected) {
      return;
    }

    const clientOption =
      this._negotiations[TelnetOptions.TELOPT_STATUS]?.client;

    const serverOption =
      this._negotiations[TelnetOptions.TELOPT_STATUS]?.server;

    if (
      clientOption === undefined ||
      clientOption !== TelnetControlSequences.DO
    ) {
      return;
    }

    if (
      serverOption === undefined ||
      serverOption !== TelnetControlSequences.WILL
    ) {
      return;
    }

    this.telnetSocket.writeSub(TelnetOptions.TELOPT_STATUS, buffer);
  }

  public sendTimingMark(): void {
    this.telnetSocket.writeWill(TelnetOptions.TELOPT_TM);
  }

  public disconnect(): void {
    this.teardownOptionStateTracking();

    this.telnetSocket.end();

    this.connected = false;

    logger.info(`[${this.socketId}] [Telnet-Client] Disconnected`);
  }

  private handleConnect(): void {
    logger.info(
      `[${this.socketId}] [Telnet-Client] Connected. Starting negotiation process.`,
    );

    this.connected = true;

    this.setupOptionStateTracking();

    for (const [option, handler] of this.optionsHandler) {
      const handlerResult = handler.negotiate?.();

      if (handlerResult !== undefined) {
        this.updateNegotiations(option, {
          client: handlerResult.controlSequence,
          clientChunk: handlerResult.subNegotiationResult?.clientChunk,
          clientOption: handlerResult.subNegotiationResult?.clientOption,
        });
      }
    }
  }

  private handleClose(hadErrors: boolean): void {
    this.connected = false;

    this.teardownOptionStateTracking();

    this.emit('close', hadErrors);
  }

  private handleDo(option: TelnetOptions): void {
    this.updateNegotiations(option, {
      server: TelnetControlSequences.DO,
    });

    // Timing Mark is excluded here since it needs a whole round-trip to the client
    // We dont want to answer directly so we wait for the client to send the timing mark
    if (option === TelnetOptions.TELOPT_TM) {
      return;
    }

    const handler = this.optionsHandler.get(option);

    if (
      this._negotiations[option]?.client !== undefined &&
      handler?.isDynamic !== true
    ) {
      return;
    }

    const handlerResult = handler?.handleDo();

    if (handlerResult !== undefined) {
      this.updateNegotiations(option, {
        client: handlerResult.controlSequence,
        clientChunk: handlerResult.subNegotiationResult?.clientChunk,
        clientOption: handlerResult.subNegotiationResult?.clientOption,
      });
    } else {
      this.telnetSocket.writeWont(option);

      this.updateNegotiations(option, {
        client: TelnetControlSequences.WONT, // we answer negatively but we should WILL everything possible
      });
    }

    return;
  }

  private setupOptionStateTracking(): void {
    this.teardownOptionStateTracking();

    for (const [option, handler] of this.optionsHandler.entries()) {
      const state = handler.getState?.();

      if (state !== undefined) {
        this.optionStateMap.set(option, state);
      }

      if (handler.onStateChange) {
        const listener = (state: unknown) => {
          this.optionStateMap.set(option, state);

          this.emit('negotiationStateChanged', { option, state });
        };

        handler.onStateChange(listener);

        this.optionStateListeners.push({ handler, listener });
      }
    }
  }

  private teardownOptionStateTracking(): void {
    for (const { handler, listener } of this.optionStateListeners) {
      handler.offStateChange?.(listener);
    }

    this.optionStateListeners = [];

    this.optionStateMap.clear();
  }

  private handleDont(option: TelnetOptions): void {
    this.updateNegotiations(option, {
      server: TelnetControlSequences.DONT,
    });

    const handler = this.optionsHandler.get(option);

    if (
      this._negotiations[option]?.client !== undefined &&
      handler?.isDynamic !== true
    ) {
      return;
    }

    const handlerResult = handler?.handleDont();

    if (handlerResult !== undefined) {
      this.updateNegotiations(option, {
        client: handlerResult.controlSequence,
        clientChunk: handlerResult.subNegotiationResult?.clientChunk,
        clientOption: handlerResult.subNegotiationResult?.clientOption,
      });
    } else {
      this.telnetSocket.writeWont(option);

      this.updateNegotiations(option, {
        client: TelnetControlSequences.WONT,
      });
    }
  }

  private handleWill(option: TelnetOptions): void {
    this.updateNegotiations(option, {
      server: TelnetControlSequences.WILL,
    });

    const handler = this.optionsHandler.get(option);

    if (
      this._negotiations[option]?.client !== undefined &&
      handler?.isDynamic !== true
    ) {
      return;
    }

    const handlerResult = handler?.handleWill();

    if (handlerResult !== undefined) {
      this.updateNegotiations(option, {
        client: handlerResult.controlSequence,
        clientChunk: handlerResult.subNegotiationResult?.clientChunk,
        clientOption: handlerResult.subNegotiationResult?.clientOption,
      });
    } else {
      this.telnetSocket.writeDont(option);

      this.updateNegotiations(option, {
        client: TelnetControlSequences.DONT, // we answer negatively but we should DO everything possible
      });
    }
  }

  private handleWont(option: TelnetOptions): void {
    this.updateNegotiations(option, {
      server: TelnetControlSequences.WONT,
    });

    const handler = this.optionsHandler.get(option);

    if (
      this._negotiations[option]?.client !== undefined &&
      handler?.isDynamic !== true
    ) {
      return;
    }

    const handlerResult = handler?.handleWont();

    if (handlerResult !== undefined) {
      this.updateNegotiations(option, {
        client: handlerResult.controlSequence,
        clientChunk: handlerResult.subNegotiationResult?.clientChunk,
        clientOption: handlerResult.subNegotiationResult?.clientOption,
      });
    } else {
      this.telnetSocket.writeDont(option);

      this.updateNegotiations(option, {
        client: TelnetControlSequences.DONT, // we answer negatively but we should DO everything possible
      });
    }
  }

  private handleSub(option: TelnetOptions, serverChunk: Buffer): void {
    this.updateNegotiations(option, {
      serverChunk,
    });

    const handler = this.optionsHandler.get(option);

    const handlerResult = handler?.handleSub?.(serverChunk);

    if (handlerResult !== undefined && handlerResult !== null) {
      this.updateNegotiations(option, handlerResult);
    }
  }

  /**
   * Updates the negotiations and subnegotiations for a given Telnet option.
   * This method allows updating both the control sequences and the subnegotiations.
   *
   * @param {TelnetOptions} option - The Telnet option to update.
   * @param {Object} negotiations - An object containing the server and client control sequences, as well as subnegotiations.
   * @param {TelnetControlSequences} [negotiations.server] - The server control sequence for the option.
   * @param {TelnetControlSequences} [negotiations.client] - The client control sequence for the option.
   * @param {Buffer} [negotiations.serverChunk] - The server chunk for subnegotiations (optional).
   * @param {Buffer} [negotiations.clientChunk] - The client chunk for subnegotiations (optional).
   * @param {string} [negotiations.clientOption] - The client option for subnegotiations (optional).
   */
  private updateNegotiations(
    option: TelnetOptions,
    negotiations: {
      server?: TelnetControlSequences;
      client?: TelnetControlSequences;
      serverChunk?: Buffer;
      clientChunk?: Buffer;
      clientOption?: string;
    },
  ): void {
    const existing = this._negotiations[option] || {};

    // Update the control sequences for server and client
    const updatedNegotiation = {
      ...existing,
      server: negotiations.server ?? existing.server,
      client: negotiations.client ?? existing.client,
      subnegotiation: {
        // Only define serverChunks if there is a new serverChunk or it already exists
        ...(existing.subnegotiation?.serverChunks || negotiations.serverChunk
          ? {
              serverChunks: [
                ...(existing.subnegotiation?.serverChunks || []),
                ...(negotiations.serverChunk
                  ? [negotiations.serverChunk.toString()]
                  : []),
              ],
            }
          : {}),
        // Only define clientChunks if there is a new clientChunk or it already exists
        ...(existing.subnegotiation?.clientChunks || negotiations.clientChunk
          ? {
              clientChunks: [
                ...(existing.subnegotiation?.clientChunks || []),
                ...(negotiations.clientChunk
                  ? [negotiations.clientChunk.toString()]
                  : []),
              ],
            }
          : {}),
        clientOption:
          negotiations.clientOption ?? existing.subnegotiation?.clientOption,
      },
    };

    // Update the negotiations object
    this._negotiations[option] = updatedNegotiation;

    // Emit event with the updated negotiation values
    this.emit('negotiationChanged', {
      option,
      client: negotiations.client,
      server: negotiations.server,
    });
  }
}

function createTelnetConnection(
  useTls: boolean,
  telnetHost: string,
  telnetPort: number,
) {
  // Resolve 'localhost' to '127.0.0.1' explicitly to avoid issues with
  // Node.js 22's autoSelectFamily (happy eyeballs) on Windows.
  // When autoSelectFamily is enabled (default since Node 20), 'localhost'
  // is resolved via DNS which may return both ::1 (IPv6) and 127.0.0.1 (IPv4).
  // The happy eyeballs algorithm then tries both in parallel, which can fail
  // on Windows when the target only listens on one address family.
  const resolvedHost =
    telnetHost.toLowerCase() === 'localhost' ? '127.0.0.1' : telnetHost;

  if (resolvedHost !== telnetHost) {
    logger.info(
      `[Telnet-Client] Resolved '${telnetHost}' to '${resolvedHost}' (bypassing happy eyeballs DNS)`,
    );
  }

  let socket;

  if (useTls) {
    socket = tls.connect({
      host: resolvedHost,
      port: telnetPort,
      rejectUnauthorized: true,
    });
  } else {
    socket = net.createConnection({
      host: resolvedHost,
      port: telnetPort,
    });
  }

  return socket;
}

/**
 * Extracts network-error details from an Error (code, syscall, address, port).
 * These properties exist at runtime on Node.js network errors but are not
 * fully covered by the NodeJS.ErrnoException type definition.
 */
function extractNetworkErrorDetails(
  error: Error,
): Record<string, unknown> {
  const err = error as unknown as Record<string, unknown>;

  return {
    message: error.message,
    code: err['code'],
    syscall: err['syscall'],
    address: err['address'],
    port: err['port'],
    stack: error.stack,
  };
}

/**
 * Formats a connection error for structured logging.
 * Handles AggregateError (from Node.js happy-eyeballs DNS resolution)
 * by unpacking the individual sub-errors with their messages and stacks.
 */
function formatConnectionError(error: Error): Record<string, unknown> {
  // AggregateError check via property presence (ES2020 target has no AggregateError type)
  const errRecord = error as unknown as Record<string, unknown>;

  if ('errors' in error && Array.isArray(errRecord['errors'])) {
    const subErrors = errRecord['errors'] as Error[];

    return {
      errorType: 'AggregateError',
      message: error.message,
      errors: subErrors.map((subError: Error, index: number) => ({
        index,
        ...extractNetworkErrorDetails(subError),
      })),
    };
  }

  return {
    errorType: error.constructor.name,
    ...extractNetworkErrorDetails(error),
  };
}
