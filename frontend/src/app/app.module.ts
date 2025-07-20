import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CoreModule } from '@mudlet3/frontend/core';

import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [CoreModule, BrowserModule],
  providers: [provideHttpClient(withInterceptorsFromDi())], // Todo: Wtf?
})
export class AppModule {}
