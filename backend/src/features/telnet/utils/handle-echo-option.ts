import { TelnetSocket } from 'telnet-stream';

import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptions } from '../types/telnet-options.js';

const handleEchoDo = (socket: TelnetSocket) => (): TelnetControlSequences => {
  socket.writeWill(TelnetOptions.TELOPT_ECHO);

  return TelnetControlSequences.WILL;
};

const handleEchoDont = (socket: TelnetSocket) => (): TelnetControlSequences => {
  socket.writeWont(TelnetOptions.TELOPT_ECHO);

  return TelnetControlSequences.WONT;
};

const handleEchoWill = (socket: TelnetSocket) => (): TelnetControlSequences => {
  socket.writeDo(TelnetOptions.TELOPT_ECHO);

  return TelnetControlSequences.DO;
};

const handleEchoWont = (socket: TelnetSocket) => (): TelnetControlSequences => {
  socket.writeDont(TelnetOptions.TELOPT_ECHO);

  return TelnetControlSequences.DONT;
};

export const handleEchoOption = (socket: TelnetSocket): TelnetOptionHandler => {
  return {
    handleDo: handleEchoDo(socket),
    handleDont: handleEchoDont(socket),
    handleWill: handleEchoWill(socket),
    handleWont: handleEchoWont(socket),
  };
};
