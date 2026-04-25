/**
 * Socket.IO events the frontend client can emit to the backend.
 */
export interface ClientToServerEvents {
  /**
   * Requests a telnet connection using the provided initial viewport size.
   * @param initialViewPort - Client's terminal dimensions
   * @param sessionToken - Persistent session identifier (UUID) across socket reconnections
   */
  mudConnect: (
    initialViewPort: { columns: number; rows: number },
    sessionToken: string,
  ) => void;
  /**
   * Requests that the server tears down the active telnet connection.
   */
  mudDisconnect: () => void;
  /**
   * Sends user input to the MUD server.
   */
  mudInput: (data: string) => void;
  /**
   * Updates the server with the client's current terminal dimensions.
   */
  mudViewportSize: (columns: number, rows: number) => void;
  /**
   * Sends a GMCP message to the MUD server.
   * @param module - The GMCP module string, e.g. "Core.Hello"
   * @param data - The data payload (JSON-serializable)
   */
  mudGmcpOutgoing: (module: string, data: unknown) => void;
}
