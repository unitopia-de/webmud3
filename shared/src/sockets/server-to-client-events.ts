import type { LinemodeState } from './linemode-state.js';

/**
 * Socket.IO events the backend can emit to the frontend client.
 */
export interface ServerToClientEvents {
  /**
   * Sends rendered MUD output to the connected client.
   */
  mudOutput: (data: string) => void;
  /**
   * Signals that the MUD connection was closed.
   */
  mudDisconnected: () => void;
  /**
   * Signals that the MUD connection was successfully established.
   */
  mudConnected: () => void;
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
}
