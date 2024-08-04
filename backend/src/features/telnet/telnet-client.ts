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
import { TelnetOptions } from './types/telnet-options.js';
import { TelnetSocketWrapper } from './utils/telnet-socket-wrapper.js';

type TelnetClientEvents = {
  data: [string | Buffer];
  close: [boolean];
};

/**
 * Represents a client for handling telnet communication tailored for MUD games.
 */
export class TelnetClient extends EventEmitter<TelnetClientEvents> {
  private negotiations: TelnetNegotiations = {};

  private readonly telnetSocket: TelnetSocket;

  private connected: boolean = false;

  public get isConnected(): boolean {
    return this.connected;
  }

  public get getNegotiations(): TelnetNegotiations {
    return { ...this.negotiations };
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
    logger.info(`[Telnet-Client] Send message`, {
      data,
    });

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

        // socket_io.emit('mud-signal', {
        //   signal: 'NOECHO-END',
        //   id: this.mudOptions?.id,
        // });

        return;
      }
    }

    this.telnetSocket.writeDo(option);

    this.updateNegotiations(option, {
      server: TelnetControlSequences.WONT,
      client: TelnetControlSequences.DO,
    });
  }

  private handleSub(option: TelnetOptions, chunkData: Buffer): void {
    // Todo[myst] save this as well in the this.negotiations object to see what is currently sub-negotiated

    if (
      option === TelnetOptions.TELOPT_TTYPE &&
      new Uint8Array(chunkData)[0] === 1
    ) {
      const nullBuf = Buffer.alloc(1, 0); // TELQUAL_IS

      const buf = Buffer.from('WebMud3a');

      const sendBuf = Buffer.concat([nullBuf, buf], buf.length + 1);

      this.telnetSocket.writeSub(option, sendBuf);

      return;
    }

    if (
      option === TelnetOptions.TELOPT_CHARSET &&
      new Uint8Array(chunkData)[0] === 1
    ) {
      const nullBuf = Buffer.alloc(1, 2); // ACCEPTED

      const buf = Buffer.from('UTF-8');

      const sendBuf = Buffer.concat([nullBuf, buf], buf.length + 1);

      this.telnetSocket.writeSub(option, sendBuf);

      return;
    }

    if (option === TelnetOptions.TELOPT_GMCP) {
      const tmpstr = chunkData.toString();

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
    this.negotiations[TelnetOptions[option] as keyof typeof TelnetOptions] = {
      server: TelnetControlSequences[
        negotiations.server
      ] as keyof typeof TelnetControlSequences,
      client: TelnetControlSequences[
        negotiations.client
      ] as keyof typeof TelnetControlSequences,
    };
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
