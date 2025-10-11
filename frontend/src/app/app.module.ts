import { BrowserModule } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { NgModule, inject, provideAppInitializer } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { APP_BASE_HREF } from '@angular/common';

import { providePrimeNG } from 'primeng/config';
// import Aura from '@primeng/themes/aura';
// import Lara from '@primeng/themes/lara';
// import Material from '@primeng/themes/material';
import Nora from '@primeng/themes/nora';

import { DialogService } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MudModule } from './mud/mud.module';
import { WINDOW_PROVIDERS } from './shared/WINDOW_PROVIDERS';
import { NonportalModule } from './nonportal/nonportal.module';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ModelessModule } from './modeless/modeless.module';
// import { ServiceWorkerModule } from '@angular/service-worker';
// import { environment } from '../environments/environment';
import { MudConfigService } from './mud-config.service';
import { getBaseLocation } from './app-common-functions';
/* eslint @typescript-eslint/ban-types: "warn" */
export function setupAppConfigServiceFactory(
  service: MudConfigService,
): Function {
  // console.log("LOADING Config");
  return () => service.load();
}

@NgModule(
  { 
    declarations: [AppComponent],
    bootstrap: [AppComponent], 
    imports: [
      BrowserModule,
      Toast,
        MudModule,
        NonportalModule,
        ModelessModule,
        AppRoutingModule
      ], 
    providers: [
        WINDOW_PROVIDERS,
        provideAnimationsAsync(),
        providePrimeNG({
          theme:{
            preset: Nora,
            options: {
              darkModeSelector: '.my-app-dark'
          }
        },
          ripple: true,
        }),
        MessageService,
        DialogService,
        CookieService,
        provideAppInitializer(() => {
        const initializerFn = (setupAppConfigServiceFactory)(inject(MudConfigService));
        return initializerFn();
      }),
        {
            provide: APP_BASE_HREF,
            useFactory: getBaseLocation,
        },
        provideHttpClient(withInterceptorsFromDi()),
    ] })
export class AppModule {}
