import { TelnetOptions } from './../models/telnet-options.js';
import { TelnetNegotiationResult } from './telnet-negotiation-result.js';

/**
 * Represents the state of negotiations for Telnet options, including both server
 * and client control sequences, as well as any subnegotiation data.
 */
export type TelnetNegotiations = {
  -readonly [key in keyof typeof TelnetOptions]?: TelnetNegotiationResult;
};
