import { Socket } from 'net';
import { TelnetSocket, TelnetSocketOptions } from 'telnet-stream';

import { logNegotiation } from './log-negotiation.js';

export class TelnetSocketWrapper extends TelnetSocket {
  public override writeDo(option: number): void {
    logNegotiation('Send', 'do', option);

    super.writeDo(option);
  }

  public override writeDont(option: number): void {
    logNegotiation('Send', 'dont', option);

    super.writeDont(option);
  }

  public override writeWill(option: number): void {
    logNegotiation('Send', 'will', option);

    super.writeWill(option);
  }

  public override writeWont(option: number): void {
    logNegotiation('Send', 'wont', option);

    super.writeWont(option);
  }

  public override writeSub(option: number, buffer: Buffer): void {
    logNegotiation('Send', 'sub', option, buffer);

    super.writeSub(option, buffer);
  }

  constructor(socket: Socket, options?: TelnetSocketOptions) {
    super(socket, options);

    this.on('will', (option) => logNegotiation('Received', 'will', option));

    this.on('wont', (option) => logNegotiation('Received', 'wont', option));

    this.on('do', (option) => logNegotiation('Received', 'do', option));

    this.on('dont', (option) => logNegotiation('Received', 'dont', option));

    this.on('sub', (option, chunkData) =>
      logNegotiation('Received', 'sub', option, chunkData),
    );

    this.on('command', (command) =>
      logNegotiation('Received', 'command', command),
    );
  }
}
