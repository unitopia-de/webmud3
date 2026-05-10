import { TelnetSocket } from 'telnet-stream';

import { TelnetOptions } from '../models/telnet-options.js';
import { TelnetControlSequences } from '../types/telnet-control-sequences.js';
import { TelnetOptionHandler } from '../types/telnet-option-handler.js';
import { TelnetOptionResult } from '../types/telnet-option-result.js';

/**
 * Telnet handler for `TELOPT_MXP` (option 91, MUD Extension Protocol).
 *
 * Stage-1 implementation: we *accept* the negotiation so UNItopia starts
 * embedding MXP markup in the data stream, but we do not act on the markup
 * yet. The frontend `MxpStreamFilter` strips the resulting bytes before
 * xterm sees them. Higher-level handling (clickable exits, ENTITY tracking,
 * `<stat>` rendering) follows in later stages — see u3_migrate/MXP.md.
 */
const handleMxpDo = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWill(TelnetOptions.TELOPT_MXP);
  return { controlSequence: TelnetControlSequences.WILL };
};

const handleMxpDont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeWont(TelnetOptions.TELOPT_MXP);
  return { controlSequence: TelnetControlSequences.WONT };
};

const handleMxpWill = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDo(TelnetOptions.TELOPT_MXP);
  return { controlSequence: TelnetControlSequences.DO };
};

const handleMxpWont = (socket: TelnetSocket) => (): TelnetOptionResult => {
  socket.writeDont(TelnetOptions.TELOPT_MXP);
  return { controlSequence: TelnetControlSequences.DONT };
};

export const handleMxpOption = (socket: TelnetSocket): TelnetOptionHandler => {
  return {
    handleDo: handleMxpDo(socket),
    handleDont: handleMxpDont(socket),
    handleWill: handleMxpWill(socket),
    handleWont: handleMxpWont(socket),
  };
};
