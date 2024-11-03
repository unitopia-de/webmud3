import { TelnetSocket } from 'telnet-stream';

import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetNegotiationResult } from '../types/telnet-negotiation-result.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptions } from '../types/telnet-options.js';

const handleEchoDo = (socket: TelnetSocket) => (): TelnetNegotiationResult => {
  socket.writeWill(TelnetOptions.TELOPT_ECHO);

  return { controlSequence: TelnetControlSequences.WILL };
};

const handleEchoDont =
  (socket: TelnetSocket) => (): TelnetNegotiationResult => {
    socket.writeWont(TelnetOptions.TELOPT_ECHO);

    return { controlSequence: TelnetControlSequences.WONT };
  };

const handleEchoWill =
  (socket: TelnetSocket) => (): TelnetNegotiationResult => {
    socket.writeDo(TelnetOptions.TELOPT_ECHO);

    return { controlSequence: TelnetControlSequences.DO };
  };

const handleEchoWont =
  (socket: TelnetSocket) => (): TelnetNegotiationResult => {
    socket.writeDont(TelnetOptions.TELOPT_ECHO);

    return { controlSequence: TelnetControlSequences.DONT };
  };

export const handleEchoOption = (socket: TelnetSocket): TelnetOptionHandler => {
  return {
    handleDo: handleEchoDo(socket),
    handleDont: handleEchoDont(socket),
    handleWill: handleEchoWill(socket),
    handleWont: handleEchoWont(socket),
  };
};
