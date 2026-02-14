export type EnvironmentKeys =
  | 'HOST' // Optional | defaults to '0.0.0.0' | the IP the backend will listen for
  | 'PORT' // Optional | defaults to 5000 | the PORT the backend will listen for
  | 'NAME' // Required | the name of your client. Will be send to the MUD. Defaults to 'webmud3b'
  | 'TELNET_HOST' // Required (unless MUD_CONFIG_PATH is set) | the IP of your MUD
  | 'TELNET_PORT' // Required (unless MUD_CONFIG_PATH is set) | the PORT of your MUD
  | 'TELNET_TLS' // Optional | defaults to 'false' | set this to true if you want a secure connection
  | 'SOCKET_TIMEOUT' // in milliseconds | default: 900000 (15 min) | determines how long messages are buffed for the disconnected frontend and when the telnet connection is closed
  | 'SOCKET_ROOT' // Required | URL for the socket connection. e.g. 'https://mud.example.com/socket.io'
  | 'ENVIRONMENT' // Optional | accepts values 'development' or 'production' | defaults to 'production' | Enables Debug REST Endpoint /api/info and allows for permissive CORS if set to 'development'
  | 'CORS_ALLOWED_ORIGINS' // Optional | comma separated list of origins that are allowed when ENVIRONMENT=production
  | 'LOG_LEVEL' // Optional | winston level: error|warn|info|http|verbose|debug|silly | defaults to 'debug'
  | 'MUD_CONFIG_PATH'; // Optional | path to mud_config.json | if not set or file not found, TELNET_HOST/PORT are used as fallback
