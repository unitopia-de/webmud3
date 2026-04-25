import type { LinemodeState } from './linemode-state.js';

/**
 * Socket.IO events the backend can emit to the frontend client.
 */
export interface ServerToClientEvents {
  /**
   * Sends rendered MUD output to the connected client.
   */
  mudOutput: (data: string, seq: number) => void;
  /**
   * Sends a batch of buffered outputs (used on reconnect recovery).
   */
  mudOutputBatch?: (entries: Array<{ data: string; seq: number }>) => void;
  /**
   * Signals that the MUD connection was closed.
   */
  mudDisconnected: () => void;
  /**
   * Signals that the MUD connection was successfully established.
   * @param isNewConnection - true if this is a new telnet connection, false if reconnected to existing
   * @param sessionToken - The session token confirmed by the server
   */
  mudConnected: (isNewConnection: boolean, sessionToken: string) => void;
  /**
   * Instructs the client to enable or disable local echo mode.
   */
  setEchoMode: (showEchos: boolean) => void;
  /**
   * Requests that the client acknowledges a telnet timing mark.
   */
  requestTimingMark: (callback: () => void) => void;
  /**
   * Sends the current linemode negotiation state to the client.
   */
  setLinemode: (state: LinemodeState) => void;
  /**
   * Signals that GMCP has been activated or deactivated.
   */
  mudGmcpActive: (active: boolean) => void;
  /**
   * Forwards a parsed GMCP message from the MUD server to the client.
   * @param packageName - The GMCP package, e.g. "Char"
   * @param messageName - The GMCP message, e.g. "Name"
   * @param data - The parsed JSON payload
   */
  mudGmcpIncoming: (
    packageName: string,
    messageName: string,
    data: unknown,
  ) => void;
}
