import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CoreModule } from '@mudlet3/frontend/core';

import { AppComponent } from './app.component';
import { ServerConfigService } from './features/serverconfig/server-config.service';

/* eslint @typescript-eslint/ban-types: "warn" */
// export function setupAppConfigServiceFactory(
//   service: MudConfigService,
// ): Function {
//   // console.log("LOADING Config");
//   return () => service.load();
// }

export function setupServerConfigServiceFactory(
  service: ServerConfigService,
): Function {
  return () => service.load();
}

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [CoreModule, BrowserModule],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: setupServerConfigServiceFactory,
      deps: [ServerConfigService],
      multi: true,
    },
    provideHttpClient(withInterceptorsFromDi()),
  ],
})
export class AppModule {}
