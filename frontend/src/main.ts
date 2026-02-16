import { enableProdMode, inject, provideAppInitializer } from '@angular/core';
import { ROUTES } from '@angular/router';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { environment } from './environments/environment';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { ServerConfigService } from './app/features/serverconfig/server-config.service';
import { GmcpBootstrapService } from './app/features/gmcp/gmcp-bootstrap.service';
import { MenuBootstrapService } from './app/features/menu/menu-bootstrap.service';
import { MudConfigService } from './app/features/mud-config/mud-config.service';
import { buildAppRoutes } from './app/app.routes';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter([], withComponentInputBinding()),
    provideAppInitializer(() => {
      const config = inject(ServerConfigService);

      return config.load();
    }),
    provideAppInitializer(() => {
      const mudConfig = inject(MudConfigService);

      return mudConfig.load();
    }),
    provideAppInitializer(() => {
      const gmcpBootstrap = inject(GmcpBootstrapService);

      gmcpBootstrap.bootstrap();
    }),
    provideAppInitializer(() => {
      const menuBootstrap = inject(MenuBootstrapService);

      menuBootstrap.bootstrap();
    }),
    {
      provide: ROUTES,
      useFactory: (mudConfig: MudConfigService) => buildAppRoutes(mudConfig),
      deps: [MudConfigService],
      multi: true,
    },
  ],
}).catch((err) => console.error(err));
