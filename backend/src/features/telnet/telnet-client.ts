// Das siegreiche Gnomi sagt: Es gibt so ein paar Telnet-Optionen, die m.E.
//         jeder Client unterstuetzen sollte: NAWS, CHARSET, EOR, ECHO,
//         STARTTLS.
// Das siegreiche Gnomi sagt: Ah, und SGA oder LINEMODE

import EventEmitter from 'events';
import net from 'net';
import { TelnetSocket } from 'telnet-stream';
import tls from 'tls';

import { logger } from '../../shared/utils/logger.js';
import { TelnetCharsetSubnogiation } from './types/telnet-charset-subnogiation.js';
import { TelnetControlSequences } from './types/telnet-control-sequences.js';
import { TelnetNegotiations } from './types/telnet-negotiations.js';
import { TelnetOptions } from './types/telnet-options.js';
import { TelnetSocketWrapper } from './utils/telnet-socket-wrapper.js';

type TelnetClientEvents = {
  data: [string | Buffer];
  close: [boolean];
  negotiationChanged: [
    {
      option: TelnetOptions;
      server: TelnetControlSequences;
      client: TelnetControlSequences;
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
    private readonly encoding: BufferEncoding,
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

    logger.info(`[Telnet-Client] Created`);

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

  private handleClose(hadErrors: boolean): void {
    this.connected = false;

    this.emit('close', hadErrors);
  }

  private handleDo(option: TelnetOptions): void {
    switch (option) {
      case TelnetOptions.TELOPT_CHARSET: {
        this.telnetSocket.writeWill(option);

        this.updateNegotiations(option, {
          server: TelnetControlSequences.DO,
          client: TelnetControlSequences.WILL,
        });

        return;
      }

      case TelnetOptions.TELOPT_TM: {
        this.updateNegotiations(option, {
          server: TelnetControlSequences.DO,
          client: TelnetControlSequences.WILL,
        });

        this.telnetSocket.writeWill(option);

        return;
      }

      case TelnetOptions.TELOPT_NAWS: {
        this.updateNegotiations(option, {
          server: TelnetControlSequences.DO,
          client: TelnetControlSequences.WILL,
        });

        this.telnetSocket.writeWill(option);

        return;
      }
    }

    this.updateNegotiations(option, {
      server: TelnetControlSequences.DO,
      client: TelnetControlSequences.WONT,
    });

    this.telnetSocket.writeWont(option);

    return;
  }

  private handleDont(option: TelnetOptions): void {
    this.telnetSocket.writeWont(option);

    this.updateNegotiations(option, {
      server: TelnetControlSequences.DONT,
      client: TelnetControlSequences.WONT,
    });
  }

  private handleWill(option: TelnetOptions): void {
    switch (option) {
      case TelnetOptions.TELOPT_CHARSET: {
        this.telnetSocket.writeDo(option);

        this.updateNegotiations(option, {
          server: TelnetControlSequences.WILL,
          client: TelnetControlSequences.DO,
        });

        return;
      }

      case TelnetOptions.TELOPT_ECHO: {
        this.telnetSocket.writeDo(option);

        this.updateNegotiations(option, {
          server: TelnetControlSequences.WILL,
          client: TelnetControlSequences.DO,
        });

        // socket_io.emit('mud-signal', {
        //   signal: 'NOECHO-START',
        //   id: this.mudOptions?.id,
        // });

        return;
      }

      case TelnetOptions.TELOPT_GMCP: {
        this.telnetSocket.writeDo(option);

        this.updateNegotiations(option, {
          server: TelnetControlSequences.WILL,
          client: TelnetControlSequences.DO,
        });

        return;
      }
    }

    this.updateNegotiations(option, {
      server: TelnetControlSequences.WILL,
      client: TelnetControlSequences.DONT,
    });

    this.telnetSocket.writeDont(option);
  }

  private handleWont(option: TelnetOptions): void {
    switch (option) {
      case TelnetOptions.TELOPT_ECHO: {
        this.telnetSocket.writeDont(option);

        this.updateNegotiations(option, {
          server: TelnetControlSequences.WONT,
          client: TelnetControlSequences.DONT,
        });

        return;
      }
    }

    this.telnetSocket.writeDo(option);

    this.updateNegotiations(option, {
      server: TelnetControlSequences.WONT,
      client: TelnetControlSequences.DO,
    });
  }

  private handleSub(option: TelnetOptions, serverChunk: Buffer): void {
    if (
      option === TelnetOptions.TELOPT_TTYPE &&
      new Uint8Array(serverChunk)[0] === 1
    ) {
      const nullBuf = Buffer.alloc(1, 0); // TELQUAL_IS

      const buf = Buffer.from('WebMud3a');

      const sendBuf = Buffer.concat([nullBuf, buf], buf.length + 1);

      this.telnetSocket.writeSub(option, sendBuf);

      return;
    }

    if (
      option === TelnetOptions.TELOPT_CHARSET &&
      new Uint8Array(serverChunk)[0] ===
        TelnetCharsetSubnogiation.CHARSET_REQUEST
    ) {
      const command = Buffer.alloc(
        1,
        TelnetCharsetSubnogiation.CHARSET_ACCEPTED,
      );

      const serverCharsets = serverChunk.toString().split(' ');

      /**
       * This function remappes the given charset from the environment to the one supported by the Telnet server
       */
      const matchCharset = (
        charset: BufferEncoding,
        serverCharsets: string[],
      ): string => {
        if (charset === 'utf-8') {
          if (serverCharsets.includes('UTF-8')) {
            return 'UTF-8';
          }
        }

        if (charset === 'ascii') {
          if (serverCharsets.includes('US-ASCII')) {
            return 'US-ASCII';
          }
        }

        if (charset === 'latin1') {
          if (serverCharsets.includes('ISO-8859-1')) {
            return 'ISO-8859-1';
          }
        }

        logger.warn(
          `[Socket-Manager] [Client] charset ${charset} is not supported by the Telnet server. Only ${serverCharsets.join(', ')} are supported. Default to utf-8`,
        );

        return 'UTF-8';
      };

      const charset = matchCharset(this.encoding, serverCharsets);

      const data = Buffer.from(charset);

      const message = Buffer.concat([command, data], data.length + 1);

      this.updateSubNegotiation(TelnetOptions.TELOPT_CHARSET, {
        clientChunk: message.toString(),
        serverChunk: serverChunk.toString(),
        clientOption: data.toString().toLocaleLowerCase(),
      });

      this.telnetSocket.writeSub(option, message);

      return;
    }

    if (option === TelnetOptions.TELOPT_GMCP) {
      const tmpstr = serverChunk.toString();

      const ix = tmpstr.indexOf(' ');

      // const jx = tmpstr.indexOf('.');

      let jsdata = tmpstr.substr(ix + 1);
      if (ix < 0 || jsdata === '') jsdata = '{}';

      // socket_io.emit(
      //   'mud-gmcp-incoming',
      //   this.mudOptions?.id,
      //   tmpstr.substr(0, jx),
      //   tmpstr.substr(jx + 1, ix - jx),
      //   JSON.parse(jsdata),
      // );

      return;
    }
  }

  /**
   * Updates the negotiations for a given Telnet option with the provided server and client control sequences.
   * This function is special because it maps all enum values to its keys, making it easier to observe.
   *
   * @param {TelnetOptions} option - The Telnet option to update the negotiations for.
   * @param {Object} negotiations - An object containing the server and client control sequences for the option.
   * @param {TelnetControlSequences} negotiations.server - The server control sequence for the option.
   * @param {TelnetControlSequences} negotiations.client - The client control sequence for the option.
   */
  private updateNegotiations(
    option: TelnetOptions,
    negotiations: {
      server: TelnetControlSequences;
      client: TelnetControlSequences;
    },
  ): void {
    this._negotiations[option] = {
      server: TelnetControlSequences[
        negotiations.server
      ] as keyof typeof TelnetControlSequences,
      client: TelnetControlSequences[
        negotiations.client
      ] as keyof typeof TelnetControlSequences,
    };

    this.emit('negotiationChanged', {
      option,
      client: negotiations.client,
      server: negotiations.server,
    });
  }

  private updateSubNegotiation(
    option: TelnetOptions,
    subnegotiation: {
      serverChunk: string;
      clientChunk: string;
      clientOption: string;
    },
  ): void {
    const existing = this._negotiations[option];

    // It is not allowed to discuss subnegotiations without a negotiation beforehand
    if (existing) {
      existing.subnegotiation = subnegotiation;
    }
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
