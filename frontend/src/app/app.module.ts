import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
// import { ServiceWorkerModule } from '@angular/service-worker';
// import { environment } from '../environments/environment';
import { CoreModule } from '@mudlet3/frontend/core';
import { GmcpModule } from '@mudlet3/frontend/features/gmcp';
import { MudconfigModule } from '@mudlet3/frontend/features/mudconfig';
import { SettingsModule } from '@mudlet3/frontend/features/settings';
import { WidgetsModule } from '@mudlet3/frontend/features/widgets';
import { CookieService } from 'ngx-cookie-service';
import { SharedModule } from 'primeng/api';

import { AppComponent } from './app.component';
import { MudConfigService } from './features/config/mud-config.service';
import { ModelessModule } from './features/modeless/modeless.module';
import { PrimeModule } from './shared/prime.module';
import { WINDOW_PROVIDERS } from './shared/WINDOW_PROVIDERS';

/* eslint @typescript-eslint/ban-types: "warn" */
export function setupAppConfigServiceFactory(
  service: MudConfigService,
): Function {
  // console.log("LOADING Config");
  return () => service.load();
}

const features = [
  GmcpModule,
  ModelessModule,
  MudconfigModule,
  SettingsModule,
  WidgetsModule,
];

@NgModule({ declarations: [AppComponent],
    bootstrap: [AppComponent], imports: [PrimeModule,
        ...features,
        SharedModule,
        CoreModule,
        BrowserModule], providers: [
        WINDOW_PROVIDERS,
        CookieService,
        {
            provide: APP_INITIALIZER,
            useFactory: setupAppConfigServiceFactory,
            deps: [MudConfigService],
            multi: true,
        },
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class AppModule {}
