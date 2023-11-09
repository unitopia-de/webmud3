import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MudclientComponent } from './mudclient/mudclient.component';
import { MudmenuComponent } from './mudmenu/mudmenu.component';
import { MudspanComponent } from './mudspan/mudspan.component';
import { PrimeModule } from '../prime.module';
import { SettingsModule } from '../settings/settings.module';
import { WidgetsModule } from '../widgets/widgets.module';

@NgModule({
  declarations: [MudclientComponent, MudmenuComponent, MudspanComponent],
  imports: [
    CommonModule,
    BrowserModule,
    PrimeModule,
    BrowserAnimationsModule,
    FormsModule,
    SettingsModule,
    WidgetsModule,
  ],
  exports: [MudclientComponent],
})
export class MudModule {}
