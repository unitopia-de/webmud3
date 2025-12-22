import { Socket } from 'net';
import { TelnetSocket, TelnetSocketOptions } from 'telnet-stream';

import { logger } from '../../../shared/utils/logger.js';
import { TelnetOptions } from '../models/telnet-options.js';

export class TelnetSocketWrapper extends TelnetSocket {
  public override writeDo(option: number): void {
    this.logNegotiation('Send', 'do', option);

    super.writeDo(option);
  }

  public override writeDont(option: number): void {
    this.logNegotiation('Send', 'dont', option);

    super.writeDont(option);
  }

  public override writeWill(option: number): void {
    this.logNegotiation('Send', 'will', option);

    super.writeWill(option);
  }

  public override writeWont(option: number): void {
    this.logNegotiation('Send', 'wont', option);

    super.writeWont(option);
  }

  public override writeSub(option: number, buffer: Buffer): void {
    this.logNegotiation('Send', 'sub', option, buffer);

    super.writeSub(option, buffer);
  }

  constructor(
    private readonly clientSocketId: string,
    socket: Socket,
    options?: TelnetSocketOptions,
  ) {
    super(socket, options);

    this.on('will', (option) =>
      this.logNegotiation('Received', 'will', option),
    );

    this.on('wont', (option) =>
      this.logNegotiation('Received', 'wont', option),
    );

    this.on('do', (option) => this.logNegotiation('Received', 'do', option));

    this.on('dont', (option) =>
      this.logNegotiation('Received', 'dont', option),
    );

    this.on('sub', (option, chunkData) =>
      this.logNegotiation('Received', 'sub', option, chunkData),
    );

    this.on('command', (command) =>
      this.logNegotiation('Received', 'command', command),
    );
  }

  private logNegotiation(
    perspective: 'Received' | 'Send',
    action: string,
    option: number,
    data?: Buffer,
  ) {
    // be careful since typescript does not recognize the value as undefined if you provide a number not in the enum
    const opt = TelnetOptions[option] as string | undefined;

    logger.verbose(
      `[${this.clientSocketId}] [Telnet-Socket] ${perspective} ${action} for option ${opt ?? 'unknown (number: ' + option + ')'}`,
      data ? { data: data.toString() } : {},
    );
  }
}
