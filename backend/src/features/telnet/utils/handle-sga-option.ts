import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

const handleNegotiation = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_SGA);

  return { controlSequence: TelnetControlSequences.DO };
};

const handleSGADo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_SGA);

  return { controlSequence: TelnetControlSequences.WILL };
};

const handleSGADont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_SGA);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleSGAWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_SGA);

  return { controlSequence: TelnetControlSequences.DO };
};

const handleSGAWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_SGA);

  return { controlSequence: TelnetControlSequences.DONT };
};

export const handleSGAOption = (socket: TelnetSocket): TelnetOptionHandler => {
  return {
    negotiate: handleNegotiation(socket),
    handleDo: handleSGADo(socket),
    handleDont: handleSGADont(socket),
    handleWill: handleSGAWill(socket),
    handleWont: handleSGAWont(socket),
    isDynamic: true,
  };
};
