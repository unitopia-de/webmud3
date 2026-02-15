import type { LogConfig } from '../app/shared/utils/logger.types';

export interface Environment {
  production: boolean;
  backendUrl: () => string;
  logging: LogConfig;
}
