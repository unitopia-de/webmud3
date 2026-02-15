import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  backendUrl: () => window.location.href,
  logging: {
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
  },
};
