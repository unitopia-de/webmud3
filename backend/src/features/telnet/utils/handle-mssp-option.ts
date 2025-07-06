import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

const handleMSSPDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_MSSP);

  return { controlSequence: TelnetControlSequences.WILL };
};

const handleMSSPDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_MSSP);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleMSSPWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_MSSP);

  return { controlSequence: TelnetControlSequences.DO };
};

const handleMSSPWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_MSSP);

  return { controlSequence: TelnetControlSequences.DONT };
};

export const handleMSSPOption = (socket: TelnetSocket): TelnetOptionHandler => {
  return {
    handleDo: handleMSSPDo(socket),
    handleDont: handleMSSPDont(socket),
    handleWill: handleMSSPWill(socket),
    handleWont: handleMSSPWont(socket),
  };
};
