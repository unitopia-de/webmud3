import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { AppComponent } from './app.component';
import { WINDOW_PROVIDERS } from './shared/WINDOW_PROVIDERS';
import { PrimeModule } from './shared/prime.module';
import { HttpClientModule } from '@angular/common/http';
// import { ServiceWorkerModule } from '@angular/service-worker';
// import { environment } from '../environments/environment';
import { MudConfigService } from './features/config/mud-config.service';
import { ModelessModule } from './features/modeless/modeless.module';
import { CoreModule } from '@mudlet3/frontend/core';
import { SharedModule } from 'primeng/api';
import { SettingsModule } from '@mudlet3/frontend/features/settings';
import { WidgetsModule } from '@mudlet3/frontend/features/widgets';
import { MudconfigModule } from '@mudlet3/frontend/features/mudconfig';
import { GmcpModule } from '@mudlet3/frontend/features/gmcp';

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
]

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    PrimeModule,
    ...features,
    SharedModule,
    CoreModule,
    // ServiceWorkerModule.register('ngsw-worker.js', {
    //   enabled: environment.production,
    //   registrationStrategy: 'registerImmediately'
    // })
  ],
  providers: [
    WINDOW_PROVIDERS,
    CookieService,
    {
      provide: APP_INITIALIZER,
      useFactory: setupAppConfigServiceFactory,
      deps: [MudConfigService],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
