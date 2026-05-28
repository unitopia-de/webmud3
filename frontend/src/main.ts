import {
  enableProdMode,
  inject,
  provideAppInitializer,
  provideZoneChangeDetection,
} from '@angular/core';

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

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideHttpClient(withInterceptorsFromDi()),
    provideAppInitializer(() => {
      const config = inject(ServerConfigService);

      return config.load();
    }),
  ],
}).catch((err) => console.error(err));
