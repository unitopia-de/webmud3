import { enableProdMode, inject, provideAppInitializer } from '@angular/core';

import { environment } from './environments/environment';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { ServerConfigService } from './app/features/serverconfig/server-config.service';
import { GmcpBootstrapService } from './app/features/gmcp/gmcp-bootstrap.service';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideAppInitializer(() => {
      const config = inject(ServerConfigService);

      return config.load();
    }),
    provideAppInitializer(() => {
      const gmcpBootstrap = inject(GmcpBootstrapService);

      gmcpBootstrap.bootstrap();
    }),
  ],
}).catch((err) => console.error(err));
