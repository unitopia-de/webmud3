import { APP_INITIALIZER, enableProdMode } from '@angular/core';

import { environment } from './environments/environment';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { ServerConfigService } from './app/features/serverconfig/server-config.service';

if (environment.production) {
  enableProdMode();
}

export function setupServerConfigServiceFactory(
  service: ServerConfigService,
): Function {
  return () => service.load();
}

bootstrapApplication(AppComponent, {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: setupServerConfigServiceFactory,
      deps: [ServerConfigService],
      multi: true,
    },
    provideHttpClient(withInterceptorsFromDi()), // war früher in providers[]
  ],
}).catch((err) => console.error(err));
