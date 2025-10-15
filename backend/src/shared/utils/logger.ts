import winston from 'winston';

const logMetadata = (enable: boolean) =>
  winston.format((info) => {
    if (!enable) {
      return info;
    }

    if (info.metadata && Object.keys(info.metadata).length > 0) {
      info.message += `\n${JSON.stringify(info.metadata)}`;
    }

    return info;
  })();

/**
 * Hinweis zu den unterstützen Log-Leveln in der Priotiätsreihenfolge:
 * - error
 * - warn
 * - info
 * - http
 * - verbose
 * - debug
 * - silly
 **/
const logger = winston.createLogger({
  level: 'debug',
  levels: winston.config.npm.levels,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.metadata({
      fillExcept: ['message', 'level', 'timestamp', 'label'],
    }),
    logMetadata(false),
    winston.format.printf(
      (info) => `[${info.timestamp}] [${info.level}] ${info.message}`,
    ),
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}]\t${info.message}`,
        ),
      ),
    }),
  ],
  exitOnError: false,
});

export { logger };
