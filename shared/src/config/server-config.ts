/**
 * Configuration provided by the backend that the frontend needs to connect.
 */
export interface ServerConfig {
  /**
   * Socket.IO path or namespace exposed by the backend server.
   */
  socketNamespace: string;
}
