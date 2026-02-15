import type { LogCategory, LogConfig, LogLevel } from './logger.types';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const DEFAULT_CONFIG: LogConfig = {
  categories: {
    App: 'error',
    ServerConfig: 'error',
    Sockets: 'error',
    MudClient: 'error',
    ScreenReader: 'error',
    OutputHistory: 'error',
    MudPromptManager: 'error',
    MudSocketAdapter: 'error',
  },
};

let currentConfig: LogConfig = DEFAULT_CONFIG;

const getCategoryLevel = (category: LogCategory): LogLevel | null =>
  currentConfig.categories[category] ?? null;

const isLevelEnabled = (category: LogCategory, level: LogLevel): boolean => {
  const categoryLevel = getCategoryLevel(category);
  if (!categoryLevel) {
    return false;
  }

  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[categoryLevel];
};

const logWithCategory = (
  level: LogLevel,
  category: LogCategory,
  ...args: unknown[]
): void => {
  if (!isLevelEnabled(category, level)) {
    return;
  }

  const prefix = `[${category}]`;

  switch (level) {
    case 'debug':
      console.debug(prefix, ...args); // get the stack trace for debug logs - very verbose
      return;
    case 'info':
      console.info(prefix, ...args); // alias console.log
      return;
    case 'warn':
      console.warn(prefix, ...args);
      return;
    case 'error':
      console.error(prefix, ...args);
      return;
  }
};

export const logger: {
  log: (level: LogLevel, category: LogCategory, ...args: unknown[]) => void;
  debug: (category: LogCategory, ...args: unknown[]) => void;
  info: (category: LogCategory, ...args: unknown[]) => void;
  warn: (category: LogCategory, ...args: unknown[]) => void;
  error: (category: LogCategory, ...args: unknown[]) => void;
} = {
  log: (level, category, ...args) => logWithCategory(level, category, ...args),
  debug: (category, ...args) => logWithCategory('debug', category, ...args),
  info: (category, ...args) => logWithCategory('info', category, ...args),
  warn: (category, ...args) => logWithCategory('warn', category, ...args),
  error: (category, ...args) => logWithCategory('error', category, ...args),
};

export const configureLogger = (config: LogConfig): void => {
  currentConfig = {
    categories: { ...config.categories },
  };
};

export const getLoggerConfig = (): LogConfig => ({
  categories: { ...currentConfig.categories },
});
