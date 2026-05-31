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
import { provideServiceWorker } from '@angular/service-worker';

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
    // Service Worker (PWA). Only active in production builds — the
    // `serviceWorker` option in angular.json's production configuration emits
    // ngsw-worker.js, and `enabled` mirrors that so `ng serve` / dev builds
    // stay SW-free. `registerWhenStable:30000` defers registration until the
    // app is stable (or 30s), so the SW install doesn't compete with the
    // initial MUD connect.
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
}).catch((err) => console.error(err));
