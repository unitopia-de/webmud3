import EventEmitter from 'events';
import net from 'net';
import { TelnetSocket } from 'telnet-stream';
import tls from 'tls';

import { logger } from '../../shared/utils/logger.js';
import { TelnetOptions } from './models/telnet-options.js';
import { TelnetControlSequences } from './types/telnet-control-sequences.js';
import { TelnetNegotiations } from './types/telnet-negotiations.js';
import { TelnetOptionHandler } from './types/telnet-option-handler.js';
import { handleCharsetOption } from './utils/handle-charset-option.js';
import { handleEchoOption } from './utils/handle-echo-option.js';
import { handleLinemodeOption } from './utils/handle-linemode-option.js';
import { handleNawsOption } from './utils/handle-naws-option.js';
import { handleSGAOption } from './utils/handle-sga-option.js';
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
};

/**
 * Represents a client for handling telnet communication tailored for MUD games.
 */
export class TelnetClient extends EventEmitter<TelnetClientEvents> {
  private _negotiations: TelnetNegotiations = {};

  private readonly telnetSocket: TelnetSocket;

  private connected: boolean = false;

  private optionsHandler: Map<TelnetOptions, TelnetOptionHandler>;

  public get isConnected(): boolean {
    return this.connected;
  }

  public get negotiations(): TelnetNegotiations {
    return { ...this._negotiations };
  }

  /**
   * Constructs a new instance of the TelnetClient class.
   *
   * @param {string} telnetHost - The hostname or IP address of the Telnet server.
   * @param {number} telnetPort - The port number of the Telnet server.
   * @param {boolean} useTls - Indicates whether to use TLS encryption for the connection.
   */
  constructor(
    telnetHost: string,
    telnetPort: number,
    useTls: boolean,
    clientName: string,
  ) {
    super();

    const telnetConnection = createTelnetConnection(
      useTls,
      telnetHost,
      telnetPort,
    );

    this.telnetSocket = new TelnetSocketWrapper(telnetConnection, {
      // Todo[myst]: Is this the right buffer size? Is it needed anyway?
      bufferSize: 65536,
    });

    this.optionsHandler = new Map([
      [TelnetOptions.TELOPT_CHARSET, handleCharsetOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_ECHO, handleEchoOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_NAWS, handleNawsOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_SGA, handleSGAOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_LINEMODE, handleLinemodeOption(this.telnetSocket)],
      [
        TelnetOptions.TELOPT_TTYPE,
        handleTTypeOption(this.telnetSocket, clientName),
      ],
    ]);

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
      this.emit('data', chunkData);
    });
  }

  public sendMessage(data: string): void {
    this.telnetSocket.write(data);
  }

  public disconnect(): void {
    logger.info(`[Telnet-Client] Disconnect`);

    this.telnetSocket.end();

    this.connected = false;
  }

  private handleConnect(): void {
    logger.info(`[Telnet-Client] Connected. Starting negotiation process.`);

    this.connected = true;

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

    this.emit('close', hadErrors);
  }

  private handleDo(option: TelnetOptions): void {
    this.updateNegotiations(option, {
      server: TelnetControlSequences.DO,
    });

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
                  ? [`0x${negotiations.serverChunk.toString('hex')}`]
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
                  ? [`0x${negotiations.clientChunk.toString('hex')}`]
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
  let socket;

  if (useTls) {
    socket = tls.connect({
      host: telnetHost,
      port: telnetPort,
      rejectUnauthorized: true,
    });

    logger.info(`[Socket-Manager] created https connection for telnet`, {
      host: telnetHost,
      port: telnetPort,
      rejectUnauthorized: true,
    });
  } else {
    socket = net.createConnection({
      host: telnetHost,
      port: telnetPort,
    });

    logger.info(`[Socket-Manager] created http connection for telnet`, {
      host: telnetHost,
      port: telnetPort,
    });
  }

  return socket;
}
