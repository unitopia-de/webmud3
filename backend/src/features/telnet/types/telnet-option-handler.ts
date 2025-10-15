import { TelnetNegotiationResult } from './telnet-negotiation-result.js';
import { TelnetOptionResult } from './telnet-option-result.js';
import { TelnetSubnegotiationResult } from './telnet-subnegotiation-result.js';

/**
 * A set of handler functions for managing Telnet option negotiation.
 * Each handler responds to a specific Telnet negotiation command (DO, DON'T, WILL, WON'T),
 * and optionally handles subnegotiation.
 */
export type TelnetOptionHandler<TState = unknown> = {
  /**
   * Intiate a negotiation with the server.
   * @returns {TelnetOptionResult} The control sequence (DO, DONT, WILL, WONT) sent back to the server.
   */
  negotiate?: () => TelnetOptionResult;

  /**
   * Handles the "DO" command sent by the server, indicating that the server
   * wants the client to enable a particular option.
   *
   * @returns {TelnetOptionResult} The control sequence (WILL, WONT) sent back to the server.
   */
  handleDo: (
    getPreviousNegotiation?: () => TelnetNegotiationResult | undefined,
  ) => TelnetOptionResult;

  /**
   * Handles the "DON'T" command sent by the server, indicating that the server
   * wants the client to disable a particular option.
   *
   * @returns {TelnetControlSequences} The control sequence (WILL, WONT) sent back to the server.
   */
  handleDont: (
    getPreviousNegotiation?: () => TelnetNegotiationResult | undefined,
  ) => TelnetOptionResult;

  /**
   * Handles the "WILL" command sent by the server, indicating that the server
   * is willing to enable a particular option.
   *
   * @returns {TelnetOptionResult} The control sequence (DO, DONT) sent back to the server.
   */
  handleWill: (
    getPreviousNegotiation?: () => TelnetNegotiationResult | undefined,
  ) => TelnetOptionResult;

  /**
   * Handles the "WON'T" command sent by the server, indicating that the server
   * is unwilling to enable a particular option.
   *
   * @returns {TelnetOptionResult} The control sequence (DO, DONT) sent back to the server.
   */
  handleWont: (
    getPreviousNegotiation?: () => TelnetNegotiationResult | undefined,
  ) => TelnetOptionResult;

  /**
   * Handles the subnegotiation message sent by the server.
   *
   * @param {Buffer} serverChunk - The data chunk sent by the server during subnegotiation.
   * @returns {TelnetSubnegotiationResult | null} The subnegotiation result, or null if not applicable.
   */
  handleSub?: (serverChunk: Buffer) => TelnetSubnegotiationResult;

  /**
   * Returns the current state for this option, if it maintains state.
   */
  getState?: () => TState;

  /**
   * Registers a listener that is invoked whenever the option state changes.
   * Implementations should immediately invoke the listener with the current state.
   *
   * @returns {() => void} A function that removes the registered listener.
   */
  onStateChange?: (listener: (state: TState) => void) => void;

  /**
   * Removes a listener that was previously registered via onStateChange.
   *
   * @param listener - The listener to remove.
   */
  offStateChange?: (listener: (state: TState) => void) => void;

  /**
   * Returns true if the option is dynamic. That means it can be re-negotiated after the client has made a decision.
   * This is used in ECHO and the somewhat broken CHARSET option (server switches from DO to WILL, after we anwser WILL).
   * You probably don't want to use this for your own options.
   *
   * @returns {boolean} True if the option is dynamic, false otherwise.
   */
  isDynamic?: boolean;
};


