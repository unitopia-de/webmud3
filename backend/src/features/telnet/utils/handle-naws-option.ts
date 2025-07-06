import { TelnetSocket } from 'telnet-stream';

import { sizeToBuffer } from '../../../shared/utils/size-to-buffer.js';
import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

const DEFAULT_VIEWPORT_WIDTH = 80;

const DEFAULT_VIEWPORT_HEIGHT = 25;

const handleNawsDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_NAWS);

  const buffer = sizeToBuffer(DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_HEIGHT);

  socket.writeSub(TelnetOptions.TELOPT_NAWS, buffer);

  return {
    controlSequence: TelnetControlSequences.WONT,
    subNegotiationResult: {
      clientChunk: buffer,
      clientOption: `${DEFAULT_VIEWPORT_WIDTH}x${DEFAULT_VIEWPORT_HEIGHT}`,
    },
  };
};

const handleNawsDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_NAWS);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleNawsWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_NAWS);

  // We do not allow the MUD to set the window size since this makes no sense in our responsive client
  // so any subnogitiation is ignored.
  return { controlSequence: TelnetControlSequences.DONT };
};

const handleNawsWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_NAWS);

  return { controlSequence: TelnetControlSequences.DONT };
};

export const handleNawsOption = (socket: TelnetSocket): TelnetOptionHandler => {
  return {
    handleDo: handleNawsDo(socket),
    handleDont: handleNawsDont(socket),
    handleWill: handleNawsWill(socket),
    handleWont: handleNawsWont(socket),
  };
};
