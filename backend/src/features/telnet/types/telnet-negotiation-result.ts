import { TelnetControlSequences } from './telnet-control-sequences.js';
import { TelnetSubnegotiationResult } from './telnet-subnegotiation-result.js';

export type TelnetNegotiationResult = {
  subNegotiationResult?: TelnetSubnegotiationResult;

  controlSequence: TelnetControlSequences;
};
