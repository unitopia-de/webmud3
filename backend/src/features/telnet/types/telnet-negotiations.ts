import { TelnetControlSequences } from './telnet-control-sequences.js';
import { TelnetOptions } from './telnet-options.js';

/**
 * Represents the negotiation status of Telnet options between a server and a client.
 * Each key in the object represents a Telnet option and its corresponding negotiation on the server and client sides.
 * But the keys are the string representation of the enum values for ease of observation.
 * The value of each key is an object with `server` and `client` properties, which are of type `TelnetControlSequences`.
 * The optional `?` in the type definition indicates that not all Telnet options may be negotiated.
 */
export type TelnetNegotiations = {
  -readonly [key in keyof typeof TelnetOptions]?: {
    server: keyof typeof TelnetControlSequences;
    client: keyof typeof TelnetControlSequences;
  };
};
