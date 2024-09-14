/**
 * Represents the result of a Telnet subnegotiation.
 * It contains the data that the client sends back to the server during subnegotiation.
 * The client option may return null if the subnegotiation is not applicable.
 */
export type TelnetSubnegotiationResult = {
  /**
   * The chunk of data that the client sends during subnegotiation.
   */
  clientChunk: Buffer;
  /**
   * The client option used during subnegotiation (e.g., a charset or mode).
   */
  clientOption: string;
} | null;
