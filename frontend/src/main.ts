import { enableProdMode, inject, provideAppInitializer } from '@angular/core';

import { environment } from './environments/environment';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { ServerConfigService } from './app/features/serverconfig/server-config.service';
import { configureLogger, logger } from './app/shared/utils/logger';

if (environment.production) {
  enableProdMode();
}

configureLogger(environment.logging);

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideAppInitializer(() => {
      const config = inject(ServerConfigService);

      return config.load();
    }),
  ],
}).catch((err) => logger.error('App', err));
