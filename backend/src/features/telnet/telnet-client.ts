// Das siegreiche Gnomi sagt: Es gibt so ein paar Telnet-Optionen, die m.E.
//         jeder Client unterstuetzen sollte: NAWS, CHARSET, EOR, ECHO,
//         STARTTLS.
// Das siegreiche Gnomi sagt: Ah, und SGA oder LINEMODE

import EventEmitter from 'events';
import net from 'net';
import { TelnetSocket } from 'telnet-stream';
import tls from 'tls';

import { logger } from '../../shared/utils/logger.js';
import { TelnetControlSequences } from './types/telnet-control-sequences.js';
import { TelnetNegotiations } from './types/telnet-negotiations.js';
import { TelnetOptionHandler } from './types/telnet-option-handler.js';
import { TelnetOptions } from './types/telnet-options.js';
import { handleCharsetOption } from './utils/handle-charset-option.js';
import { handleEchoOption } from './utils/handle-echo-option.js';
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
  constructor(telnetHost: string, telnetPort: number, useTls: boolean) {
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

    this.connected = true;
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
    logger.info(`[Telnet-Client] Connected`);
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

    const handlerResult = handler?.handleDo();

    if (handlerResult !== undefined) {
      this.updateNegotiations(option, {
        client: handlerResult,
      });
    } else {
      this.telnetSocket.writeWont(option);

      this.updateNegotiations(option, {
        client: TelnetControlSequences.WONT, // we answer negatively but we should WILL everything possible
      });
    }

    // switch (option) {

    //   case TelnetOptions.TELOPT_TM: {
    //     this.updateNegotiations(option, {
    //       server: TelnetControlSequences.DO,
    //       client: TelnetControlSequences.WILL,
    //     });

    //     this.telnetSocket.writeWill(option);

    //     return;
    //   }

    //   case TelnetOptions.TELOPT_NAWS: {
    //     this.updateNegotiations(option, {
    //       server: TelnetControlSequences.DO,
    //       client: TelnetControlSequences.WILL,
    //     });

    //     this.telnetSocket.writeWill(option);

    //     return;
    //   }
    // }

    return;
  }

  private handleDont(option: TelnetOptions): void {
    this.updateNegotiations(option, {
      server: TelnetControlSequences.DONT,
    });

    const handler = this.optionsHandler.get(option);

    const handlerResult = handler?.handleDont();

    if (handlerResult !== undefined) {
      this.updateNegotiations(option, {
        client: handlerResult,
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

    const handlerResult = handler?.handleWill();

    if (handlerResult !== undefined) {
      this.updateNegotiations(option, {
        client: handlerResult,
      });
    } else {
      this.telnetSocket.writeDont(option);

      this.updateNegotiations(option, {
        client: TelnetControlSequences.DONT, // we answer negatively but we should DO everything possible
      });
    }

    // switch (option) {

    //   case TelnetOptions.TELOPT_GMCP: {
    //     this.telnetSocket.writeDo(option);

    //     this.updateNegotiations(option, {
    //       server: TelnetControlSequences.WILL,
    //       client: TelnetControlSequences.DO,
    //     });

    //     return;
    //   }
    // }
  }

  private handleWont(option: TelnetOptions): void {
    this.updateNegotiations(option, {
      server: TelnetControlSequences.WONT,
    });

    const handler = this.optionsHandler.get(option);

    const handlerResult = handler?.handleWont();

    if (handlerResult !== undefined) {
      this.updateNegotiations(option, {
        client: handlerResult,
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
      ...{
        server: negotiations.server ?? existing.server,
        client: negotiations.client ?? existing.client,
      },
    };

    // Update the subnegotiation properties if they exist
    if (existing) {
      updatedNegotiation.subnegotiation = {
        ...existing.subnegotiation,
        ...{
          serverChunk: negotiations.serverChunk
            ? negotiations.serverChunk.toString()
            : existing.subnegotiation?.serverChunk,
          clientChunk: negotiations.clientChunk
            ? negotiations.clientChunk.toString()
            : existing.subnegotiation?.clientChunk,
          clientOption:
            negotiations.clientOption ?? existing.subnegotiation?.clientOption,
        },
      };
    }

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
