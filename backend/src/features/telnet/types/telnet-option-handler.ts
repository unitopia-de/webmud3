import { TelnetNegotiationResult } from './telnet-negotiation-result.js';
import { TelnetSubnegotiationResult } from './telnet-subnegotiation-result.js';

/**
 * A set of handler functions for managing Telnet option negotiation.
 * Each handler responds to a specific Telnet negotiation command (DO, DON'T, WILL, WON'T),
 * and optionally handles subnegotiation.
 */
export type TelnetOptionHandler = {
  /**
   * Intiate a negotiation with the server.
   * @returns {TelnetNegotiationResult} The control sequence (DO, DONT, WILL, WONT) sent back to the server.
   */
  negotiate?: () => TelnetNegotiationResult;

  /**
   * Handles the "DO" command sent by the server, indicating that the server
   * wants the client to enable a particular option.
   *
   * @returns {TelnetNegotiationResult} The control sequence (WILL, WONT) sent back to the server.
   */
  handleDo: () => TelnetNegotiationResult;

  /**
   * Handles the "DON'T" command sent by the server, indicating that the server
   * wants the client to disable a particular option.
   *
   * @returns {TelnetControlSequences} The control sequence (WILL, WONT) sent back to the server.
   */
  handleDont: () => TelnetNegotiationResult;

  /**
   * Handles the "WILL" command sent by the server, indicating that the server
   * is willing to enable a particular option.
   *
   * @returns {TelnetNegotiationResult} The control sequence (DO, DONT) sent back to the server.
   */
  handleWill: () => TelnetNegotiationResult;

  /**
   * Handles the "WON'T" command sent by the server, indicating that the server
   * is unwilling to enable a particular option.
   *
   * @returns {TelnetNegotiationResult} The control sequence (DO, DONT) sent back to the server.
   */
  handleWont: () => TelnetNegotiationResult;

  /**
   * Handles the subnegotiation message sent by the server.
   *
   * @param {Buffer} serverChunk - The data chunk sent by the server during subnegotiation.
   * @returns {TelnetSubnegotiationResult | null} The subnegotiation result, or null if not applicable.
   */
  handleSub?: (serverChunk: Buffer) => TelnetSubnegotiationResult;
};
