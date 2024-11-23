import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

const handleEorDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_EOR);

  return { controlSequence: TelnetControlSequences.WILL };
};

const handleEorDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_EOR);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleEorWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_EOR);

  return { controlSequence: TelnetControlSequences.DO };
};

const handleEorWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_EOR);

  return { controlSequence: TelnetControlSequences.DONT };
};

export const handleEorOption = (socket: TelnetSocket): TelnetOptionHandler => {
  return {
    handleDo: handleEorDo(socket),
    handleDont: handleEorDont(socket),
    handleWill: handleEorWill(socket),
    handleWont: handleEorWont(socket),
  };
};
