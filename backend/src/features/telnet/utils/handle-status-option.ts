import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

const handleStatusDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_STATUS);

  return { controlSequence: TelnetControlSequences.WILL };
};

const handleStatusDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_STATUS);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleStatusWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_STATUS);

  return { controlSequence: TelnetControlSequences.DO };
};

const handleStatusWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_STATUS);

  return { controlSequence: TelnetControlSequences.DONT };
};

export const handleStatusOption = (
  socket: TelnetSocket,
): TelnetOptionHandler => {
  return {
    handleDo: handleStatusDo(socket),
    handleDont: handleStatusDont(socket),
    handleWill: handleStatusWill(socket),
    handleWont: handleStatusWont(socket),
  };
};
