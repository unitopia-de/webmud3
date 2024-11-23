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
import { handleLinemodeOption } from './utils/handle-linemode-option.js';
import { handleMSSPOption } from './utils/handle-mssp-option.js';
import { handleNawsOption } from './utils/handle-naws-option.js';
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
      [TelnetOptions.TELOPT_STATUS, handleStatusOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_MSSP, handleMSSPOption(this.telnetSocket)],
      [TelnetOptions.TELOPT_EOR, handleEorOption(this.telnetSocket)],
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
      if (command === TelnetOptions.TELOPT_EOR) {
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

      if (negotiation.option === TelnetOptions.TELOPT_EOR) {
        // Initialize EOR buffer once after successful negotiation
        // or disable the eor buffer if negotiation fails
        if (
          negotiation.server === TelnetControlSequences.WILL &&
          negotiation.client === TelnetControlSequences.DO &&
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
