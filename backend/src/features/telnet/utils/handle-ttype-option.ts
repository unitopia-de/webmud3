import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';
import { TelnetSubnegotiationResult } from '../types/telnet-subnegotiation-result.js';

const DEFAULT_TERMINAL_NAME = 'webmud3b';

enum TelnetTTypeSubnogiation {
  TTYPE_SEND = 1,
}

const handleTTypeDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_TTYPE);

  return { controlSequence: TelnetControlSequences.WILL };
};

const handleTTypeDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_TTYPE);

  return { controlSequence: TelnetControlSequences.WONT };
};

const handleTTypeWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_TTYPE);

  // This makes no sense since WE are giving the type of the terminal
  return { controlSequence: TelnetControlSequences.DONT };
};

const handleTTypeWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_TTYPE);

  return { controlSequence: TelnetControlSequences.DONT };
};

const handleTTypeSub =
  (socket: TelnetSocket) =>
  (serverChunk: Buffer): TelnetSubnegotiationResult => {
    if (new Uint8Array(serverChunk)[0] === TelnetTTypeSubnogiation.TTYPE_SEND) {
      const buffer = Buffer.from(DEFAULT_TERMINAL_NAME);

      socket.writeSub(TelnetOptions.TELOPT_TTYPE, buffer);

      return {
        clientChunk: buffer,
        clientOption: DEFAULT_TERMINAL_NAME,
      };
    }

    return null;
  };

export const handleTTypeOption = (
  socket: TelnetSocket,
): TelnetOptionHandler => {
  return {
    handleDo: handleTTypeDo(socket),
    handleDont: handleTTypeDont(socket),
    handleWill: handleTTypeWill(socket),
    handleWont: handleTTypeWont(socket),
    handleSub: handleTTypeSub(socket),
  };
};
