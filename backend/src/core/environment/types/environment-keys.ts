export type EnvironmentKeys =
  | 'HOST' // Optional. Defaults to '0.0.0.0'
  | 'PORT' // Optional. Defaults to 5000
  | 'TELNET_HOST' // Required. Example '127.0.0.1'
  | 'TELNET_PORT' // Required. Example '23'
  | 'TELNET_TLS' // Optional. Defaults to 'false'
  | 'SOCKET_TIMEOUT' // in milliseconds | default: 900000 (15 min) | determines how long messages are buffed for the disconnected frontend and when the telnet connection is closed
  | 'SOCKET_ROOT'
  | 'ENVIRONMENT';
