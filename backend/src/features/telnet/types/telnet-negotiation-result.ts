import { TelnetControlSequences } from './telnet-control-sequences.js';

export type TelnetNegotiationResult = {
  /**
   * The control sequence received from the server (DO, DON'T, WILL, WON'T).
   */
  server?: TelnetControlSequences;

  /**
   * The control sequence sent by the client (DO, DON'T, WILL, WON'T).
   */
  client?: TelnetControlSequences;

  /**
   * Optional subnegotiation data exchanged between the server and client.
   */
  subnegotiation?: {
    /**
     * The data chunk sent by the server during subnegotiation.
     */
    serverChunks?: string[];

    /**
     * The data chunk sent by the client during subnegotiation.
     */
    clientChunks?: string[];

    /**
     * The client option used during subnegotiation (e.g., a charset or mode).
     */
    clientOption?: string;
  };
};
