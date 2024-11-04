import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

const handleLinemodeDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_LINEMODE);

  return { controlSequence: TelnetControlSequences.WILL };
};

const handleLinemodeDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_LINEMODE);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleLinemodeWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_LINEMODE);

  return { controlSequence: TelnetControlSequences.DO };
};

const handleLinemodeWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_LINEMODE);

  return { controlSequence: TelnetControlSequences.DONT };
};

export const handleLinemodeOption = (
  socket: TelnetSocket,
): TelnetOptionHandler => {
  return {
    handleDo: handleLinemodeDo(socket),
    handleDont: handleLinemodeDont(socket),
    handleWill: handleLinemodeWill(socket),
    handleWont: handleLinemodeWont(socket),
  };
};
