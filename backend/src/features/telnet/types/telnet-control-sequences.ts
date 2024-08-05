/**
 * Telnet Control Sequences used for option negotiation.
 */
export enum TelnetControlSequences {
  /**
   * Confirm that the sender will start performing an option.
   */
  WILL = 251,

  /**
   * Confirm that the sender will stop performing an option.
   */
  WONT = 252,

  /**
   * Request or confirm the other party to start performing an option.
   */
  DO = 253,

  /**
   * Demand the other party to stop performing an option.
   */
  DONT = 254,
}
