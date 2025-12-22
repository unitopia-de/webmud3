/**
 * Represents the negotiated TELNET LINEMODE capabilities for a client connection.
 */
export interface LinemodeState {
  /**
   * Raw LINEMODE bitmask negotiated with the server.
   */
  mode: number;
  /**
   * Indicates whether local line editing is enabled.
   */
  edit: boolean;
  /**
   * Indicates whether interrupt and signal trapping are enabled.
   */
  trapsig: boolean;
  /**
   * Signals that tabs should be handled as soft tabs instead of fixed-width tabs.
   */
  softTab: boolean;
  /**
   * True when the server echoes characters literally instead of mirroring client edits.
   */
  literalEcho: boolean;
  /**
   * Bit-packed mask describing which control characters are forwarded to the server.
   */
  forwardMask: number[];
  /**
   * Human readable description of the characters represented in the forward mask.
   */
  forwardMaskDescription: string;
}
