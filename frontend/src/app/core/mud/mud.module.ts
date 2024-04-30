import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MudclientComponent } from './mudclient/mudclient.component';
import { MudmenuComponent } from './mudmenu/mudmenu.component';
import { MudspanComponent } from './mudspan/mudspan.component';
import { PrimeModule } from '@mudlet3/frontend/shared';
import { WidgetsModule } from '@mudlet3/frontend/features/widgets';

@NgModule({
  declarations: [MudclientComponent, MudmenuComponent, MudspanComponent],
  imports: [
    CommonModule,
    BrowserModule,
    PrimeModule,
    BrowserAnimationsModule,
    FormsModule,
    WidgetsModule,
  ],
  exports: [MudclientComponent],
})
export class MudModule {}
