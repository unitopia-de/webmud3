import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CookieService } from 'ngx-cookie-service';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MudModule } from './mud/mud.module';
import { WINDOW_PROVIDERS } from './shared/WINDOW_PROVIDERS';
import { NonportalModule } from './nonportal/nonportal.module';
import { PrimeModule } from './prime.module';
import { HttpClientModule } from '@angular/common/http';
import { ModelessModule } from './modeless/modeless.module';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,HttpClientModule,
    MudModule,NonportalModule,
    PrimeModule,ModelessModule,
    AppRoutingModule
  ],
  providers: [
    WINDOW_PROVIDERS,
    CookieService,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
