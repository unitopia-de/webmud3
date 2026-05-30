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
import { provideRouter } from '@angular/router';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { ServerConfigService } from './app/features/serverconfig/server-config.service';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideHttpClient(withInterceptorsFromDi()),
    // Top-level routing — `/` lädt die klassische Shell, `/ez` die
    // (in Aufbau befindliche) Splitscreen-Variante. Siehe app.routes.ts.
    provideRouter(routes),
    provideAppInitializer(() => {
      const config = inject(ServerConfigService);

      return config.load();
    }),
  ],
}).catch((err) => console.error(err));
