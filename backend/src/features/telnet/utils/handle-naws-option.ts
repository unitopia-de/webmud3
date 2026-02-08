import EventEmitter from 'events';
import { TelnetSocket } from 'telnet-stream';

import { logger } from '../../../shared/utils/logger.js';
import { sizeToBuffer } from '../../../shared/utils/size-to-buffer.js';
import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';
import { TelnetSubnegotiationResult } from '../types/telnet-subnegotiation-result.js';

const DEFAULT_VIEWPORT_WIDTH = 80;

const DEFAULT_VIEWPORT_HEIGHT = 15;

// const MIN_VIEWPORT_SIZE = 78;

// const MAX_VIEWPORT_SIZE = 300;

export type NawsState = {
  width: number;
  height: number;
  isActive: boolean;
};

class NawsNegotiator {
  private state: NawsState;

  private readonly emitter = new EventEmitter();

  constructor(
    private readonly socket: TelnetSocket,
    initialViewPort?: {
      columns: number;
      rows: number;
    },
  ) {
    this.state =
      initialViewPort !== undefined
        ? {
            height: initialViewPort.rows,
            width: initialViewPort.columns,
            isActive: false,
          }
        : {
            width: DEFAULT_VIEWPORT_WIDTH,
            height: DEFAULT_VIEWPORT_HEIGHT,
            isActive: false,
          };
  }

  public handleDo(): TelnetOptionResult {
    this.socket.writeWill(TelnetOptions.TELOPT_NAWS);

    this.setActive(true);

    const subNegotiationResult = this.sendCurrentSize();

    return {
      controlSequence: TelnetControlSequences.WILL,
      subNegotiationResult,
    };
  }

  public handleDont(): TelnetOptionResult {
    this.socket.writeWont(TelnetOptions.TELOPT_NAWS);

    this.setActive(false);

    return { controlSequence: TelnetControlSequences.WONT };
  }

  public handleWill(): TelnetOptionResult {
    this.socket.writeDont(TelnetOptions.TELOPT_NAWS);

    this.setActive(false);

    // We do not allow the server to change our viewport size.
    return { controlSequence: TelnetControlSequences.DONT };
  }

  public handleWont(): TelnetOptionResult {
    this.socket.writeDont(TelnetOptions.TELOPT_NAWS);

    this.setActive(false);

    return { controlSequence: TelnetControlSequences.DONT };
  }

  public getState(): NawsState {
    return this.state;
  }

  public onStateChange(listener: (state: NawsState) => void): void {
    this.emitter.on('state', listener);

    listener(this.state);
  }

  public offStateChange(listener: (state: NawsState) => void): void {
    this.emitter.off('state', listener);
  }

  public updateViewportSize(
    width: number,
    height: number,
  ): TelnetSubnegotiationResult {
    const sanitizedWidth = this.sanitizeDimension(width);

    const sanitizedHeight = this.sanitizeDimension(height);

    if (
      this.state.width === sanitizedWidth &&
      this.state.height === sanitizedHeight
    ) {
      return null;
    }

    this.state = {
      ...this.state,
      width: sanitizedWidth,
      height: sanitizedHeight,
    };

    this.emitState();

    if (!this.state.isActive) {
      return null;
    }

    return this.sendCurrentSize();
  }

  private sanitizeDimension(value: number): number {
    return value;

    // if (!Number.isFinite(value)) {
    //   return MIN_VIEWPORT_SIZE;
    // }

    // const rounded = Math.floor(value);

    // const withinMin = Math.max(rounded, MIN_VIEWPORT_SIZE);

    // return Math.min(withinMin, MAX_VIEWPORT_SIZE);
  }

  private sendCurrentSize(): TelnetSubnegotiationResult {
    const buffer = sizeToBuffer(this.state.width, this.state.height);

    this.socket.writeSub(TelnetOptions.TELOPT_NAWS, buffer);

    logger.verbose('SENDING NAWS: ', {
      width: this.state.width,
      height: this.state.height,
    });

    const clientOption = `${this.state.width}x${this.state.height}`;

    return {
      clientChunk: buffer,
      clientOption,
    };
  }

  private setActive(isActive: boolean): void {
    if (this.state.isActive === isActive) {
      return;
    }

    this.state = {
      ...this.state,
      isActive,
    };

    this.emitState();
  }

  private emitState(): void {
    this.emitter.emit('state', this.state);
  }
}

export type NawsOptionHandler = TelnetOptionHandler<NawsState> & {
  updateViewportSize: (
    width: number,
    height: number,
  ) => TelnetSubnegotiationResult;
};

export const handleNawsOption = (
  socket: TelnetSocket,
  initialViewPort?: {
    columns: number;
    rows: number;
  },
): NawsOptionHandler => {
  const negotiator = new NawsNegotiator(socket, initialViewPort);

  return {
    handleDo: () => negotiator.handleDo(),
    handleDont: () => negotiator.handleDont(),
    handleWill: () => negotiator.handleWill(),
    handleWont: () => negotiator.handleWont(),
    getState: () => negotiator.getState(),
    onStateChange: (listener) => negotiator.onStateChange(listener),
    offStateChange: (listener) => negotiator.offStateChange(listener),
    updateViewportSize: (width, height) =>
      negotiator.updateViewportSize(width, height),
  };
};
