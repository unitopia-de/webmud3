export type EnvironmentKeys =
  | 'HOST' // Optional | defaults to '0.0.0.0' | the IP the backend will listen for
  | 'PORT' // Optional | defaults to 5000 | the PORT the backend will listen for
  | 'TELNET_HOST' // Required | the IP of your MUD
  | 'TELNET_PORT' // Required | the PORT of your MUD
  | 'TELNET_TLS' // Optional | defaults to 'false' | set this to true if you want a secure connection
  | 'SOCKET_TIMEOUT' // in milliseconds | default: 900000 (15 min) | determines how long messages are buffed for the disconnected frontend and when the telnet connection is closed
  | 'SOCKET_ROOT' // Required | the named socket for
  | 'ENVIRONMENT'; // Optional | Enables Debug REST Endpoint /api/info
