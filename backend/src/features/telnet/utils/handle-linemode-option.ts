import EventEmitter from 'events';
import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';
import { TelnetSubnegotiationResult } from '../types/telnet-subnegotiation-result.js';

export type LinemodeState = {
  mode: number;
  edit: boolean;
  trapsig: boolean;
  softTab: boolean;
  literalEcho: boolean;
  forwardMask: number[];
  forwardMaskDescription: string;
};

enum SubnegotiationCommand {
  MODE = 1,
  FORWARDMASK = 2,
  SLC = 3,
}

enum ModeBits {
  EDIT = 0x01,
  TRAPSIG = 0x02,
  MODE_ACK = 0x04,
  SOFT_TAB = 0x08,
  LIT_ECHO = 0x10,
}

enum SlcFlags {
  ACK = 0x80,
}

const DEFAULT_MODE = ModeBits.EDIT | ModeBits.TRAPSIG | ModeBits.SOFT_TAB;

const DEFAULT_FORWARD_MASK_CODES = [10 /* LF */, 13 /* CR */];

const CONTROL_LABELS: Record<number, string> = {
  0: 'NUL',
  3: 'ETX',
  4: 'EOT',
  8: 'BS',
  9: 'TAB',
  10: 'LF',
  12: 'FF',
  13: 'CR',
  21: 'NAK',
  23: 'ETB',
  26: 'SUB',
};

const sanitizeMode = (mask: number): number => {
  let result = mask | ModeBits.TRAPSIG;

  if ((DEFAULT_MODE & ModeBits.SOFT_TAB) !== 0) {
    result |= ModeBits.SOFT_TAB;
  }

  return result;
};

const buildForwardMask = (codes: number[]): Buffer => {
  if (codes.length === 0) {
    return Buffer.alloc(0);
  }

  const maxCode = Math.max(...codes);

  const buffer = Buffer.alloc(Math.floor(maxCode / 8) + 1, 0);

  for (const code of codes) {
    if (code < 0) {
      continue;
    }

    const byteIndex = Math.floor(code / 8);

    const bitIndex = code % 8;

    buffer[byteIndex] |= 0x80 >> bitIndex;
  }

  return buffer;
};

const trimRightZeros = (buffer: Buffer): Buffer => {
  let end = buffer.length;

  while (end > 0 && buffer[end - 1] === 0) {
    end -= 1;
  }

  return buffer.subarray(0, end);
};

const describeForwardMask = (mask: Buffer): string => {
  const labels: string[] = [];

  mask.forEach((byte, byteIndex) => {
    for (let bit = 0; bit < 8; bit += 1) {
      if (byte & (0x80 >> bit)) {
        const code = byteIndex * 8 + bit;

        labels.push(CONTROL_LABELS[code] ?? `0x${code.toString(16)}`);
      }
    }
  });

  return labels.length > 0 ? labels.join(', ') : 'none';
};

class LinemodeNegotiator {
  private modeMask = sanitizeMode(DEFAULT_MODE);
  private forwardMask = trimRightZeros(
    buildForwardMask(DEFAULT_FORWARD_MASK_CODES),
  );
  private readonly emitter = new EventEmitter();

  constructor(private readonly socket: TelnetSocket) {}

  public getState(): LinemodeState {
    const trimmed = trimRightZeros(this.forwardMask);

    return {
      mode: this.modeMask,
      edit: (this.modeMask & ModeBits.EDIT) !== 0,
      trapsig: (this.modeMask & ModeBits.TRAPSIG) !== 0,
      softTab: (this.modeMask & ModeBits.SOFT_TAB) !== 0,
      literalEcho: (this.modeMask & ModeBits.LIT_ECHO) !== 0,
      forwardMask: [...trimmed.values()],
      forwardMaskDescription: describeForwardMask(trimmed),
    };
  }

  public onStateChange(listener: (state: LinemodeState) => void): void {
    this.emitter.on('state', listener);

    listener(this.getState());
  }

  public offStateChange(listener: (state: LinemodeState) => void): void {
    this.emitter.off('state', listener);
  }

  public handleDo(): TelnetOptionResult {
    this.socket.writeWill(TelnetOptions.TELOPT_LINEMODE);

    this.pushMode(this.modeMask);

    this.pushForwardMask(this.forwardMask);

    this.notify();

    return {
      controlSequence: TelnetControlSequences.WILL,
      subNegotiationResult: {
        clientChunk: Buffer.from(this.describe()),
        clientOption: this.describe(),
      },
    };
  }

  public handleDont(): TelnetOptionResult {
    this.socket.writeWont(TelnetOptions.TELOPT_LINEMODE);

    return { controlSequence: TelnetControlSequences.WONT };
  }

  public handleWill(): TelnetOptionResult {
    this.socket.writeDo(TelnetOptions.TELOPT_LINEMODE);

    return { controlSequence: TelnetControlSequences.DO };
  }

  public handleWont(): TelnetOptionResult {
    this.socket.writeDont(TelnetOptions.TELOPT_LINEMODE);

    return { controlSequence: TelnetControlSequences.DONT };
  }

  public handleSubnegotiation(
    chunk: Buffer,
  ): TelnetSubnegotiationResult | null {
    if (chunk.length === 0) {
      return null;
    }

    const command = chunk[0];

    if (command === SubnegotiationCommand.MODE) {
      return this.processModeChange(chunk);
    }

    if (
      command === TelnetControlSequences.DO ||
      command === TelnetControlSequences.DONT ||
      command === TelnetControlSequences.WILL ||
      command === TelnetControlSequences.WONT
    ) {
      const option = chunk[1];

      return option === SubnegotiationCommand.FORWARDMASK
        ? this.processForwardMaskNegotiation(command)
        : null;
    }

    if (command === SubnegotiationCommand.FORWARDMASK) {
      return this.processForwardMaskUpdate(chunk.subarray(1));
    }

    if (command === SubnegotiationCommand.SLC) {
      return this.acknowledgeSlc(chunk);
    }

    return null;
  }

  private processModeChange(chunk: Buffer): TelnetSubnegotiationResult {
    if (chunk.length < 2) {
      return null;
    }

    const rawMask = chunk[1];

    const acknowledge = (rawMask & ModeBits.MODE_ACK) !== 0;

    const requestedMask = sanitizeMode(rawMask & ~ModeBits.MODE_ACK);

    this.setMode(requestedMask);

    if (!acknowledge) {
      this.pushMode(this.modeMask, true);
    }

    return {
      clientChunk: Buffer.from(this.describeMode()),
      clientOption: this.describeMode(),
    };
  }

  private processForwardMaskNegotiation(
    command: TelnetControlSequences,
  ): TelnetSubnegotiationResult | null {
    switch (command) {
      case TelnetControlSequences.DO: {
        this.socket.writeSub(
          TelnetOptions.TELOPT_LINEMODE,
          Buffer.from([
            TelnetControlSequences.WILL,
            SubnegotiationCommand.FORWARDMASK,
          ]),
        );

        this.pushForwardMask(this.forwardMask);

        this.notify();

        return {
          clientChunk: Buffer.from(this.describeForwardMask()),
          clientOption: this.describeForwardMask(),
        };
      }

      case TelnetControlSequences.DONT: {
        this.socket.writeSub(
          TelnetOptions.TELOPT_LINEMODE,
          Buffer.from([
            TelnetControlSequences.WONT,
            SubnegotiationCommand.FORWARDMASK,
          ]),
        );

        this.setForwardMask(Buffer.alloc(0));

        return {
          clientChunk: Buffer.from('forwardmask disabled'),
          clientOption: 'forwardmask disabled',
        };
      }

      default:
        return null;
    }
  }

  private processForwardMaskUpdate(
    serverMask: Buffer,
  ): TelnetSubnegotiationResult | null {
    const trimmed = trimRightZeros(serverMask);

    if (trimmed.equals(this.forwardMask)) {
      return null;
    }

    this.pushForwardMask(this.forwardMask);

    return {
      clientChunk: Buffer.from(this.describeForwardMask()),
      clientOption: this.describeForwardMask(),
    };
  }

  private acknowledgeSlc(chunk: Buffer): TelnetSubnegotiationResult | null {
    if ((chunk.length - 1) % 3 !== 0) {
      return null;
    }

    const response = Buffer.from(chunk);

    for (let index = 1; index < response.length; index += 3) {
      response[index] |= SlcFlags.ACK;
    }

    this.socket.writeSub(TelnetOptions.TELOPT_LINEMODE, response);

    return {
      clientChunk: Buffer.from('slc ack'),
      clientOption: 'slc ack',
    };
  }

  private pushMode(mode: number, acknowledge = false) {
    const payload = Buffer.from([
      SubnegotiationCommand.MODE,
      acknowledge ? mode | ModeBits.MODE_ACK : mode,
    ]);

    this.socket.writeSub(TelnetOptions.TELOPT_LINEMODE, payload);
  }

  private pushForwardMask(mask: Buffer) {
    const payload = Buffer.concat(
      [Buffer.from([SubnegotiationCommand.FORWARDMASK]), mask],
      mask.length + 1,
    );

    this.socket.writeSub(TelnetOptions.TELOPT_LINEMODE, payload);
  }

  private setMode(mode: number) {
    const sanitized = sanitizeMode(mode);

    if (this.modeMask === sanitized) {
      return;
    }

    this.modeMask = sanitized;

    this.notify();
  }

  private setForwardMask(mask: Buffer) {
    const trimmed = trimRightZeros(Buffer.from(mask));

    if (this.forwardMask.equals(trimmed)) {
      return;
    }

    this.forwardMask = trimmed;

    this.notify();
  }

  private notify() {
    const state = this.getState();

    this.emitter.emit('state', state);
  }

  private describeMode(): string {
    const state = this.getState();

    const parts: string[] = [];

    if (state.edit) {
      parts.push('EDIT');
    }

    if (state.trapsig) {
      parts.push('TRAPSIG');
    }

    if (state.softTab) {
      parts.push('SOFT_TAB');
    }

    if (state.literalEcho) {
      parts.push('LIT_ECHO');
    }

    return parts.length > 0 ? parts.join(' | ') : 'NONE';
  }

  private describeForwardMask(): string {
    return `forwardmask: ${this.getState().forwardMaskDescription}`;
  }

  private describe(): string {
    return `MODE=${this.describeMode()}; ${this.describeForwardMask()}`;
  }
}

export const handleLinemodeOption = (
  socket: TelnetSocket,
): TelnetOptionHandler<LinemodeState> => {
  const negotiator = new LinemodeNegotiator(socket);

  return {
    handleDo: () => negotiator.handleDo(),
    handleDont: () => negotiator.handleDont(),
    handleWill: () => negotiator.handleWill(),
    handleWont: () => negotiator.handleWont(),
    handleSub: (chunk) => negotiator.handleSubnegotiation(chunk),
    getState: () => negotiator.getState(),
    onStateChange: (listener) => negotiator.onStateChange(listener),
    offStateChange: (listener) => negotiator.offStateChange(listener),
  };
};
