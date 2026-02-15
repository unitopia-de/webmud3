export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'App'
  | 'ServerConfig'
  | 'Sockets'
  | 'MudClient'
  | 'ScreenReader'
  | 'OutputHistory'
  | 'MudPromptManager'
  | 'MudSocketAdapter';

export type LogConfig = {
  categories: Record<LogCategory, LogLevel>;
};
