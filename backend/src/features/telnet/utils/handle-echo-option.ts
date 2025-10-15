import EventEmitter from 'events';
import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

export type EchoState = {
  /**
   * When true, the client should locally echo input characters.
   * When false, the server is expected to echo and the client should suppress local echo.
   */
  localEchoEnabled: boolean;
};

class EchoNegotiator {
  private state: EchoState = { localEchoEnabled: true };
  private readonly emitter = new EventEmitter();

  constructor(private readonly socket: TelnetSocket) {}

  public handleDo(): TelnetOptionResult {
    this.socket.writeWill(TelnetOptions.TELOPT_ECHO);

    this.updateState(true);

    return { controlSequence: TelnetControlSequences.WILL };
  }

  public handleDont(): TelnetOptionResult {
    this.socket.writeWont(TelnetOptions.TELOPT_ECHO);

    this.updateState(false);

    return { controlSequence: TelnetControlSequences.WONT };
  }

  public handleWill(): TelnetOptionResult {
    this.socket.writeDo(TelnetOptions.TELOPT_ECHO);

    this.updateState(false);

    return { controlSequence: TelnetControlSequences.DO };
  }

  public handleWont(): TelnetOptionResult {
    this.socket.writeDont(TelnetOptions.TELOPT_ECHO);

    this.updateState(true);

    return { controlSequence: TelnetControlSequences.DONT };
  }

  public getState(): EchoState {
    return this.state;
  }

  public onStateChange(listener: (state: EchoState) => void): void {
    this.emitter.on('state', listener);

    listener(this.state);
  }

  public offStateChange(listener: (state: EchoState) => void): void {
    this.emitter.off('state', listener);
  }

  private updateState(localEchoEnabled: boolean) {
    if (this.state.localEchoEnabled === localEchoEnabled) {
      return;
    }

    this.state = { localEchoEnabled };

    this.emitter.emit('state', this.state);
  }
}

export const handleEchoOption = (
  socket: TelnetSocket,
): TelnetOptionHandler<EchoState> => {
  const negotiator = new EchoNegotiator(socket);

  return {
    handleDo: () => negotiator.handleDo(),
    handleDont: () => negotiator.handleDont(),
    handleWill: () => negotiator.handleWill(),
    handleWont: () => negotiator.handleWont(),
    getState: () => negotiator.getState(),
    onStateChange: (listener) => negotiator.onStateChange(listener),
    offStateChange: (listener) => negotiator.offStateChange(listener),
    isDynamic: true,
  };
};
