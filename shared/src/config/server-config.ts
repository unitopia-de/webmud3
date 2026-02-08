/**
 * Configuration provided by the backend that the frontend needs to connect.
 */
export interface ServerConfig {
  /**
   * Socket.IO path or namespace exposed by the backend server.
   */
  socketNamespace: string;
  /**
   * Allowed Socket.IO transports.
   */
  socketTransports?: string[];
  /**
   * Socket.IO ping interval in milliseconds.
   */
  socketPingInterval?: number;
  /**
   * Socket.IO ping timeout in milliseconds.
   */
  socketPingTimeout?: number;
  /**
   * Maximum disconnection duration for session recovery.
   */
  socketTimeout?: number;
}
