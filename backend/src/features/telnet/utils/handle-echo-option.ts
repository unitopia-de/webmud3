import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

const handleEchoDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_ECHO);

  return { controlSequence: TelnetControlSequences.WILL };
};

const handleEchoDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_ECHO);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleEchoWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_ECHO);

  return { controlSequence: TelnetControlSequences.DO };
};

const handleEchoWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_ECHO);

  return { controlSequence: TelnetControlSequences.DONT };
};

export const handleEchoOption = (socket: TelnetSocket): TelnetOptionHandler => {
  return {
    handleDo: handleEchoDo(socket),
    handleDont: handleEchoDont(socket),
    handleWill: handleEchoWill(socket),
    handleWont: handleEchoWont(socket),
    isDynamic: true,
  };
};
