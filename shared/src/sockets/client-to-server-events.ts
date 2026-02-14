/**
 * Socket.IO events the frontend client can emit to the backend.
 */
export interface ClientToServerEvents {
  /**
   * Requests a telnet connection using the provided initial viewport size.
   * @param initialViewPort - Client's terminal dimensions
   * @param sessionToken - Persistent session identifier (UUID) across socket reconnections
   * @param mudId - Optional MUD identifier for Multi-MUD support. If not set, the backend
   *                falls back to TELNET_HOST/PORT environment variables.
   */
  mudConnect: (
    initialViewPort: { columns: number; rows: number },
    sessionToken: string,
    mudId?: string,
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
   * Sends a GMCP message from the frontend to the MUD server via the backend.
   * @param module - GMCP top-level module name (e.g. "Core")
   * @param message - GMCP message name (e.g. "Supports.Set")
   * @param data - JSON-serializable payload
   */
  mudGmcpOutgoing: (module: string, message: string, data: unknown) => void;
}
