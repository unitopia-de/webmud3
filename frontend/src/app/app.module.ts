import { BrowserModule } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';
import { AppComponent } from './app.component';
import { WINDOW_PROVIDERS } from './shared/WINDOW_PROVIDERS';
import { PrimeModule } from './prime.module';
import { HttpClientModule } from '@angular/common/http';
// import { ServiceWorkerModule } from '@angular/service-worker';
// import { environment } from '../environments/environment';
import { MudConfigService } from './mud-config.service';
import { MudModule } from './features/mud/mud.module';
import { ModelessModule } from './features/modeless/modeless.module';
/* eslint @typescript-eslint/ban-types: "warn" */
export function setupAppConfigServiceFactory(
  service: MudConfigService,
): Function {
  // console.log("LOADING Config");
  return () => service.load();
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    MudModule,
    PrimeModule,
    ModelessModule,
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
    // {
    //   provide: APP_BASE_HREF,
    //   useFactory: getBaseLocation,
    // },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
