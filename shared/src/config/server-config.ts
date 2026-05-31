/**
 * Configuration provided by the backend that the frontend needs to connect.
 */
export interface ServerConfig {
  /**
   * Socket.IO path or namespace exposed by the backend server.
   */
  socketNamespace: string;

  /**
   * Application title (browser tab / PWA). Driven by the backend's
   * `APP_TITLE` env var; defaults to "Webmud3".
   */
  appTitle: string;
}
