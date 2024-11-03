import { TelnetControlSequences } from './telnet-control-sequences.js';
import { TelnetOptions } from './telnet-options.js';

/**
 * Represents the state of negotiations for Telnet options, including both server
 * and client control sequences, as well as any subnegotiation data.
 */
export type TelnetNegotiations = {
  -readonly [key in keyof typeof TelnetOptions]?: {
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
      serverChunk?: string;

      /**
       * The data chunk sent by the client during subnegotiation.
       */
      clientChunk?: string;

      /**
       * The client option used during subnegotiation (e.g., a charset or mode).
       */
      clientOption?: string;
    };
  };
};
